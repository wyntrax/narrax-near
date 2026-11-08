import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import { isNearAccountId, sanitizeUntrusted } from '@narra/shared';
import { parseFtMetadata, type NearRpc } from '@narra/near';

const Envelope = z.object({ name: z.string().optional(), symbol: z.string().optional() });
export interface MetadataSource { get(mints: string[]): Promise<Map<string, { name: string; symbol: string }>> }

/**
 * Reads NEP-141 metadata through a view call. Contract-controlled text is sanitized before it is stored,
 * and the RPC URL is never exposed.
 */
export function nearMetadataSource(rpc: Pick<NearRpc, 'callFunction'>, fetchConcurrency = 4): MetadataSource {
  return {
    async get(mints) {
      const requested = mints.filter(isNearAccountId).slice(0, 100);
      const out = new Map<string, { name: string; symbol: string }>();
      for (let i = 0; i < requested.length; i += fetchConcurrency) {
        const batch = requested.slice(i, i + fetchConcurrency);
        await Promise.all(batch.map(async (mint) => {
          try {
            const response = await rpc.callFunction<unknown>(mint, 'ft_metadata');
            const metadata = parseFtMetadata(response.value);
            const name = sanitizeUntrusted(metadata.name, 64).trim();
            const symbol = sanitizeUntrusted(metadata.symbol, 32).trim();
            if (name || symbol) out.set(mint, { name, symbol });
          } catch {
            // A contract without ft_metadata is unresolved, not a placeholder value.
          }
        }));
      }
      return out;
    },
  };
}

export async function refreshTokenMetadata(db: PrismaClient, source: MetadataSource, now = new Date(), limit = 100) {
  const cursorKey = 'research.tokenMetadata.cursor', cursor = await db.systemSetting.findUnique({ where: { key: cursorKey } });
  const after = typeof cursor?.value === 'string' ? cursor.value : undefined;
  const query = { where: { OR: [{ symbol: 'UNKNOWN' }, { name: 'Unknown' }], ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: 'asc' as const }, take: Math.min(100, Math.max(1, limit)), select: { id: true, mint: true, name: true, symbol: true } };
  let rows = await db.token.findMany(query);
  if (!rows.length && after) rows = await db.token.findMany({ ...query, where: { OR: [{ symbol: 'UNKNOWN' }, { name: 'Unknown' }] } });
  const metadata = await source.get(rows.map(t => t.mint)); let resolved = 0;
  for (const t of rows) {
    const found = metadata.get(t.mint), patch: { name?: string; symbol?: string } = {};
    if (t.name === 'Unknown' && found?.name && found.name.toLowerCase() !== 'unknown') patch.name = found.name;
    if (t.symbol === 'UNKNOWN' && found?.symbol && found.symbol.toUpperCase() !== 'UNKNOWN') patch.symbol = found.symbol;
    if (Object.keys(patch).length) {
      await db.token.update({ where: { id: t.id }, data: patch });
      resolved++;
      const key = `research.tokenMetadata.${t.id}`, value = { source: 'nep141-ft-metadata', at: now.toISOString(), mint: t.mint, ...patch };
      await db.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
  }
  // Advance even past unresolved assets, so one obsolete contract cannot starve later tokens.
  if (rows.length) { const value = rows[rows.length - 1]!.id; await db.systemSetting.upsert({ where: { key: cursorKey }, create: { key: cursorKey, value }, update: { value } }); }
  return { considered: rows.length, resolved, unresolved: rows.length - resolved };
}
