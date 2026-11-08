import { z } from 'zod';
import { isNearAccountId } from '@narra/shared';
import { getJson, toNumber, type HttpOptions } from './http';
import { RateLimiter } from './limiter';
import { MarketDataError, NEAR_CHAIN_ID, NEAR_REFERENCE_CONTRACTS, type LaunchSource, type NewPool, type TokenInfo, type TokenInfoSource } from './types';

/** Documented free limit is 30 calls a minute. 2.2 s spacing leaves headroom. */
export const GECKO_MIN_INTERVAL_MS = 2200;

const InfoBody = z.object({
  data: z.object({
    attributes: z.object({
      name: z.string().nullish(),
      symbol: z.string().nullish(),
      websites: z.array(z.string()).nullish(),
      twitter_handle: z.string().nullish(),
      holders: z.object({
        count: z.number().nullish(),
        distribution_percentage: z.object({ top_10: z.union([z.string(), z.number()]).nullish() }).nullish(),
      }).nullish(),
    }),
  }),
});

const PoolsBody = z.object({
  data: z.array(z.unknown()),
  included: z.array(z.unknown()).nullish(),
});
const Pool = z.object({
  attributes: z.object({ address: z.string(), name: z.string().nullish(), pool_created_at: z.string().nullish(), reserve_in_usd: z.union([z.string(), z.number()]).nullish() }),
  relationships: z.object({ base_token: z.object({ data: z.object({ id: z.string() }).nullish() }).nullish() }).nullish(),
});
const IncludedToken = z.object({ id: z.string(), attributes: z.object({ address: z.string().nullish(), name: z.string().nullish(), symbol: z.string().nullish() }) });

export interface GeckoOptions extends HttpOptions { baseUrl?: string }

/**
 * Token metadata, holder count and concentration, and newly created pools from the public GeckoTerminal API (no key).
 * The holder fields are marked beta by the provider, and the top-10 share is of total supply, so it can include
 * liquidity pool and exchange accounts and may overstate concentration. Treat both as estimates.
 */
export class GeckoTerminalSource implements TokenInfoSource, LaunchSource {
  readonly name = 'geckoterminal';
  private readonly baseUrl: string;
  private readonly limiter: RateLimiter;
  constructor(private readonly opts: GeckoOptions = {}) {
    const base = (opts.baseUrl || 'https://api.geckoterminal.com/api/v2').replace(/\/$/, '');
    // Operators commonly supply the public origin; its API is under /api/v2, not the website root.
    this.baseUrl = base === 'https://api.geckoterminal.com' ? `${base}/api/v2` : base;
    this.limiter = opts.limiter ?? new RateLimiter(GECKO_MIN_INTERVAL_MS);
  }
  private get http(): HttpOptions {
    return { ...this.opts, limiter: this.limiter, headers: { accept: 'application/json;version=20230302', ...this.opts.headers } };
  }

  async getTokenInfo(mint: string): Promise<TokenInfo | null> {
    const { status, body } = await getJson(`${this.baseUrl}/networks/${NEAR_CHAIN_ID}/tokens/${encodeURIComponent(mint)}/info`, this.http);
    if (status === 404) return null;
    const parsed = InfoBody.safeParse(body);
    if (!parsed.success) throw new MarketDataError('shape', 'token info had an unexpected shape');
    const a = parsed.data.data.attributes;
    const count = a.holders?.count;
    const top10 = toNumber(a.holders?.distribution_percentage?.top_10);
    return {
      mint,
      name: a.name ?? null,
      symbol: a.symbol ?? null,
      // Zero holders or an out-of-range percentage means "no usable data", not a measurement.
      holders: typeof count === 'number' && Number.isInteger(count) && count > 0 ? count : null,
      top10Pct: top10 != null && top10 >= 0 && top10 <= 100 ? top10 : null,
      websites: (a.websites ?? []).filter((w) => /^https?:\/\//i.test(w)).slice(0, 5),
      twitterHandle: a.twitter_handle ?? null,
    };
  }

  /** Most recently created NEAR pools (one page, about 20). Pools with no readable token or time are skipped. */
  async getNewPools(): Promise<NewPool[]> {
    return this.getPools('new_pools');
  }
  /** A sampled discovery source, not a recommendation or paid ranking. */
  async getTrendingPools(): Promise<NewPool[]> {
    return this.getPools('trending_pools');
  }
  private async getPools(kind: 'new_pools' | 'trending_pools'): Promise<NewPool[]> {
    const { body } = await getJson(`${this.baseUrl}/networks/${NEAR_CHAIN_ID}/${kind}?include=base_token&page=1`, this.http);
    const parsed = PoolsBody.safeParse(body);
    if (!parsed.success) throw new MarketDataError('shape', 'new pools had an unexpected shape');
    const tokens = new Map<string, z.infer<typeof IncludedToken>>();
    for (const inc of parsed.data.included ?? []) {
      const t = IncludedToken.safeParse(inc);
      if (t.success) tokens.set(t.data.id, t.data);
    }
    const out: NewPool[] = [];
    for (const item of parsed.data.data) {
      const p = Pool.safeParse(item);
      if (!p.success) continue;
      const tokenId = p.data.relationships?.base_token?.data?.id;
      if (!tokenId || !p.data.attributes.pool_created_at) continue;
      const createdAt = new Date(p.data.attributes.pool_created_at);
      if (Number.isNaN(createdAt.getTime())) continue;
      const inc = tokens.get(tokenId);
      const mint = (inc?.attributes.address ?? tokenId.replace(/^near_/, '')).toLowerCase();
      if (NEAR_REFERENCE_CONTRACTS.has(mint) || !isNearAccountId(mint)) continue;
      const poolName = p.data.attributes.name ?? '';
      out.push({
        mint,
        symbol: inc?.attributes.symbol ?? poolName.split('/')[0]?.trim() ?? '',
        name: inc?.attributes.name ?? poolName.split('/')[0]?.trim() ?? '',
        poolAddress: p.data.attributes.address,
        createdAt,
        liquidityUsd: toNumber(p.data.attributes.reserve_in_usd),
      });
    }
    return out;
  }
}
