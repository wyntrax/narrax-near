import type { Prisma, PrismaClient } from '@narra/database';
import { sanitizeUntrusted, isBridgedAsset } from '@narra/shared';
import { MarketDataError, NEAR_REFERENCE_CONTRACTS, WNEAR_CONTRACT, tokenRisk, type HolderSource, type LaunchSource, type MarketQuoteSource, type MarketSnapshot, type SnapshotOmissionReason, type TokenInfo, type TokenInfoSource } from '@narra/market-data';
import { refreshTokenMetadata, type MetadataSource } from './tokenMetadata';
import { saveResearchDiagnostics } from './researchDiagnostics';

/** Starting values. None is validated against outcomes, and each should become an admin-editable setting. */
export const MARKET_DATA_LIMITS = {
  /** A new pool below this liquidity is ignored, so junk launches never become rows. Opportunities still need 20K. */
  launchMinLiquidityUsd: 5_000,
  maxLaunchesPerRun: 20,
  /** Tokens refreshed per run. Beyond this, the rest wait for the next run (ordered by id, so the same tail can starve). */
  maxTokensPerRun: 150,
  /** Of those, at most this many go to tokens with an early-radar measurement still open. */
  maxEarlyRadarTokensPerRun: 100,
  /** Slow-source calls per run. The free GeckoTerminal limit is 30 a minute, so 20 calls take about 45 s. */
  maxInfoCallsPerRun: 20,
  /** How long a token-info lookup (holders and concentration) is reused. */
  infoRefreshMs: 30 * 60_000,
  /** A token with a price row this recent stays in the refresh set. */
  activeWindowMs: 24 * 3_600_000,
  quoteBatch: 30,
} as const;

export const NEAR_PRICE_KEY = 'market.nearUsd';
export const NEAR_REFERENCE_KEY = 'market.nearReference';

export type PriceCoverageLane = 'outcomes' | 'social' | 'launches' | 'unpriced' | 'general';
export interface PriceCoverageCounts { selected: number; written: number; unavailable: number; failed: number; notRequested: number }

export interface MarketDataDeps {
  metadata?: MetadataSource | null;
  quotes: MarketQuoteSource;
  /** Optional. Without it no holder or risk rows are written, so tokens stay unranked (fail closed). */
  info: TokenInfoSource | null;
  /** Optional fallback when the primary info source has no holder data. Same fail-closed rule. */
  holders?: HolderSource | null;
  /** Optional. Without it new launches are only found through narrative and social references. */
  launches: LaunchSource | null;
}

export interface MarketDataSummary {
  launchesSeen: number;
  tokensCreated: number;
  tokensConsidered: number;
  tokensWithPrice: number;
  /** Legacy total: includes unavailable data, failed requests and unrequested batches. See priceCoverage. */
  tokensWithoutData: number;
  priceCoverage: Record<PriceCoverageLane, PriceCoverageCounts>;
  priceOmissions: Partial<Record<PriceCoverageLane, Partial<Record<SnapshotOmissionReason, number>>>>;
  metricsWritten: number;
  fdvUsedAsMarketCap: number;
  infoCalls: number;
  infoUnavailable: number;
  holderFallbackCalls: number;
  holderFallbackRows: number;
  holderRowsWritten: number;
  riskRowsWritten: number;
  nearUsd: number | null;
  errors: string[];
  /** Tokens skipped because they are bridged assets, not research candidates. */
  bridgedSkipped: number;
}

const errText = (source: string, e: unknown) => `${source}: ${e instanceof MarketDataError ? `${e.kind} (${e.message})` : (e as Error).message}`;
const clean = (s: string, max: number) => sanitizeUntrusted(s, max);
const referenceContracts = () => new Set([...NEAR_REFERENCE_CONTRACTS, process.env.NEAR_WRAP_CONTRACT?.trim() || WNEAR_CONTRACT]);

/**
 * Keeps token rows, price rows, holder rows and risk rows current from the market data sources.
 * Rules: a missing price, liquidity, volume or holder figure is never replaced by zero (the row is skipped),
 * token names and symbols are sanitized before storage, and this job only writes research data.
 */
export async function refreshMarketData(
  db: PrismaClient, deps: MarketDataDeps, now: Date = new Date(),
  opts: { maxTokens?: number; maxInfoCalls?: number; infoPriorityMints?: string[] } = {},
): Promise<MarketDataSummary> {
  const L = MARKET_DATA_LIMITS;
  const emptyCoverage = (): PriceCoverageCounts => ({ selected: 0, written: 0, unavailable: 0, failed: 0, notRequested: 0 });
  const out: MarketDataSummary = {
    launchesSeen: 0, tokensCreated: 0, tokensConsidered: 0, tokensWithPrice: 0, tokensWithoutData: 0,
    priceCoverage: { outcomes: emptyCoverage(), social: emptyCoverage(), launches: emptyCoverage(), unpriced: emptyCoverage(), general: emptyCoverage() },
    priceOmissions: {}, metricsWritten: 0, fdvUsedAsMarketCap: 0, infoCalls: 0, infoUnavailable: 0,
    holderFallbackCalls: 0, holderFallbackRows: 0, holderRowsWritten: 0, riskRowsWritten: 0, nearUsd: null, errors: [], bridgedSkipped: 0,
  };
  if (deps.metadata) { try { await refreshTokenMetadata(db, deps.metadata, now); } catch (e) { out.errors.push(errText('token metadata', e)); } }
  const refs = referenceContracts();

  // 1. NEAR/USD, kept in one settings row so every later consumer reads the same number.
  try {
    const reference = process.env.NEAR_WRAP_CONTRACT?.trim() || WNEAR_CONTRACT;
    const near = (await deps.quotes.getSnapshots([reference])).get(reference);
    if (near) {
      const value = { priceUsd: near.priceUsd, at: now.toISOString(), source: deps.quotes.name, contract: reference };
      await db.systemSetting.upsert({ where: { key: NEAR_PRICE_KEY }, create: { key: NEAR_PRICE_KEY, value }, update: { value } });
      out.nearUsd = near.priceUsd;
    } else out.errors.push('NEAR price: no usable data');
  } catch (e) { out.errors.push(errText('NEAR price', e)); }

  // 2. Launch detection. New pools with real liquidity become token rows.
  const launchMints: string[] = [];
  if (deps.launches) {
    try {
      const pools = await deps.launches.getNewPools();
      out.launchesSeen = pools.length;
      for (const p of pools.filter(p => p.liquidityUsd != null && p.liquidityUsd >= L.launchMinLiquidityUsd).slice(0, L.maxLaunchesPerRun)) {
        if (p.liquidityUsd == null || p.liquidityUsd < L.launchMinLiquidityUsd || refs.has(p.mint) || isBridgedAsset(p.mint)) continue;
        try {
          const existing = await db.token.findUnique({ where: { mint: p.mint }, select: { id: true, symbol: true, createdOnChainAt: true, blacklisted: true } });
          if (existing?.blacklisted) continue;
          const symbol = clean(p.symbol, 32), name = clean(p.name, 64);
          if (!existing) {
            await db.token.create({ data: { mint: p.mint, symbol: symbol || 'UNKNOWN', name: name || 'Unknown', createdOnChainAt: p.createdAt } });
            out.tokensCreated++;
          } else {
            const patch: Prisma.TokenUpdateInput = {};
            if (existing.symbol === 'UNKNOWN' && symbol) { patch.symbol = symbol; patch.name = name || symbol; }
            if (!existing.createdOnChainAt) patch.createdOnChainAt = p.createdAt;
            if (Object.keys(patch).length) await db.token.update({ where: { id: existing.id }, data: patch });
          }
          launchMints.push(p.mint);
        } catch (e) { out.errors.push(errText(`launch ${p.mint.slice(0, 20)}`, e)); }
      }
    } catch (e) { out.errors.push(errText(deps.launches.name, e)); }
  }

  // 3. The refresh set: tokens an early-radar outcome is waiting on, narrative candidates with no price yet,
  // fresh launches, recently priced tokens, then other narrative candidates.
  const cap = opts.maxTokens ?? L.maxTokensPerRun;
  const tokenSelect = { id: true, mint: true, symbol: true, createdOnChainAt: true, risk: { orderBy: { at: 'desc' }, take: 1, select: { at: true } } } satisfies Prisma.TokenSelect;
  const waiting = await db.earlyRadarMeasurement.findMany({ where: { status: 'PENDING' }, orderBy: [{ nextCheckAt: 'asc' }, { id: 'asc' }], take: 500, select: { outcome: { select: { tokenId: true } } } });
  const priorityIds = [...new Set(waiting.map((w) => w.outcome.tokenId))].slice(0, Math.min(L.maxEarlyRadarTokensPerRun, cap));
  const priority = priorityIds.length
    ? await db.token.findMany({ where: { id: { in: priorityIds }, blacklisted: false, mint: { notIn: [...refs] } }, orderBy: { id: 'asc' }, take: cap, select: tokenSelect })
    : [];
  const unpriced = priority.length >= cap ? [] : await db.token.findMany({
    where: { blacklisted: false, mint: { notIn: [...refs] }, id: { notIn: priority.map(t => t.id) }, metrics: { none: {} }, narratives: { some: {} } },
    orderBy: { id: 'desc' }, take: Math.ceil((cap - priority.length) / 2), select: tokenSelect,
  });
  const takenIds = [...priority, ...unpriced].map(t => t.id);
  const rest = takenIds.length >= cap ? [] : await db.token.findMany({
    where: {
      blacklisted: false, mint: { notIn: [...refs] }, id: { notIn: takenIds },
      OR: [
        { symbol: 'UNKNOWN' }, { mint: { in: launchMints } },
        { metrics: { some: { at: { gte: new Date(now.getTime() - L.activeWindowMs) } } } },
        { narratives: { some: {} } },
      ],
    },
    orderBy: { id: 'asc' }, take: cap - takenIds.length, select: tokenSelect,
  });
  const candidates = [...priority, ...unpriced, ...rest];
  const tokens = candidates.filter(t => !isBridgedAsset(t.mint));
  out.bridgedSkipped = candidates.length - tokens.length;
  out.tokensConsidered = tokens.length;

  // 4. Prices. One batch failing does not lose the others, and a 429 stops the step.
  const snaps = new Map<string, MarketSnapshot>();
  const requests = new Map<string, 'completed' | 'failed'>();
  const omissions = new Map<string, SnapshotOmissionReason>();
  const mints = tokens.map((t) => t.mint);
  for (let i = 0; i < mints.length; i += L.quoteBatch) {
    const batch = mints.slice(i, i + L.quoteBatch);
    try {
      const read = deps.quotes.getSnapshotsWithDiagnostics
        ? await deps.quotes.getSnapshotsWithDiagnostics(batch)
        : { snapshots: await deps.quotes.getSnapshots(batch), omissions: new Map<string, SnapshotOmissionReason>() };
      for (const [k, v] of read.snapshots) snaps.set(k, v);
      for (const [mint, reason] of read.omissions) omissions.set(mint, reason);
      for (const mint of batch) requests.set(mint, 'completed');
    } catch (e) {
      for (const mint of batch) requests.set(mint, 'failed');
      out.errors.push(errText(deps.quotes.name, e));
      if (e instanceof MarketDataError && e.kind === 'rate_limited') break;
    }
  }
  const launchSet = new Set(launchMints);
  const outcomeIds = new Set(priority.map(t => t.id));
  const lanes: Record<PriceCoverageLane, typeof tokens> = {
    outcomes: priority,
    social: [],
    launches: rest.filter(t => launchSet.has(t.mint)),
    unpriced,
    general: rest.filter(t => !launchSet.has(t.mint)),
  };
  for (const lane of Object.keys(lanes) as PriceCoverageLane[]) {
    const counts = out.priceCoverage[lane];
    counts.selected = lanes[lane].length;
    for (const token of lanes[lane]) {
      if (snaps.has(token.mint)) counts.written++;
      else if (requests.get(token.mint) === 'completed') {
        counts.unavailable++;
        const reasons = out.priceOmissions[lane] ??= {};
        const reason = omissions.get(token.mint) ?? 'UNSPECIFIED';
        reasons[reason] = (reasons[reason] ?? 0) + 1;
      } else if (requests.get(token.mint) === 'failed') counts.failed++;
      else counts.notRequested++;
    }
  }
  for (const t of tokens) {
    const s = snaps.get(t.mint);
    if (!s) { out.tokensWithoutData++; continue; }
    out.tokensWithPrice++;
    await db.$transaction(async tx => {
      const metric = await tx.tokenMetric.create({ data: { tokenId: t.id, priceUsd: s.priceUsd, marketCapUsd: s.marketCapUsd, liquidityUsd: s.liquidityUsd, volume24hUsd: s.volume24hUsd, at: now } });
      const value = { metricId: metric.id, at: now.toISOString(), source: deps.quotes.name, marketCapIsFdv: s.marketCapIsFdv, priceChange1hPct: s.priceChange1hPct, pairAddress: s.pairAddress, dexId: s.dexId, pairCreatedAt: s.pairCreatedAt?.toISOString() ?? null };
      const key = `research.market.${t.id}`;
      await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
      const historyKey = `research.marketMetric.${metric.id}`;
      await tx.systemSetting.create({ data: { key: historyKey, value } });
    });
    out.metricsWritten++;
    if (s.marketCapIsFdv) out.fdvUsedAsMarketCap++;
    const patch: Prisma.TokenUpdateInput = {};
    if (t.symbol === 'UNKNOWN' && s.symbol) { patch.symbol = clean(s.symbol, 32) || 'UNKNOWN'; patch.name = clean(s.name, 64) || patch.symbol; }
    if (!t.createdOnChainAt && s.pairCreatedAt) patch.createdOnChainAt = s.pairCreatedAt;
    if (Object.keys(patch).length) await db.token.update({ where: { id: t.id }, data: patch });
  }

  // 5. Holders and risk. Missing or failed attribution remains unknown, never zero.
  if (deps.info) {
    const infoPriority = new Set(opts.infoPriorityMints ?? []);
    const due = tokens
      .filter((t) => snaps.has(t.mint) && (!t.risk[0] || now.getTime() - t.risk[0].at.getTime() >= L.infoRefreshMs))
      .sort((a, b) => {
        // The demo refresh names its documented PASS example so a slow or rate-limited holder source
        // cannot starve it behind older rows. Normal worker runs leave this unset.
        const priority = Number(infoPriority.has(b.mint)) - Number(infoPriority.has(a.mint));
        return priority || (a.risk[0]?.at.getTime() ?? 0) - (b.risk[0]?.at.getTime() ?? 0);
      })
      .slice(0, opts.maxInfoCalls ?? L.maxInfoCallsPerRun);
    for (const t of due) {
      const s = snaps.get(t.mint)!;
      let info: TokenInfo | null;
      try {
        info = await deps.info.getTokenInfo(t.mint);
        out.infoCalls++;
      } catch (e) {
        out.errors.push(errText(deps.info.name, e));
        if (e instanceof MarketDataError && e.kind === 'rate_limited') break;
        continue;
      }

      // GeckoTerminal has no holder data for many NEAR tokens. NearBlocks is the fallback; if both
      // sources are silent, the token stays unknown and unranked.
      let holders = info?.holders ?? null;
      let top10Pct = info?.top10Pct ?? null;
      if ((holders == null || top10Pct == null) && deps.holders) {
        out.holderFallbackCalls++;
        try {
          const fallback = await deps.holders.getHolderEvidence(t.mint);
          if (fallback) {
            holders = holders ?? fallback.holders;
            top10Pct = top10Pct ?? fallback.top10Pct;
            out.holderFallbackRows++;
          }
        } catch (e) {
          out.errors.push(errText(deps.holders.name, e));
          if (e instanceof MarketDataError && e.kind === 'rate_limited') break;
        }
      }

      const created = t.createdOnChainAt ?? s.pairCreatedAt;
      const pairAgeMinutes = created ? (now.getTime() - created.getTime()) / 60_000 : null;
      const risk = tokenRisk({ liquidityUsd: s.liquidityUsd, holders, top10Pct, pairAgeMinutes });
      if (holders == null || top10Pct == null) { out.infoUnavailable++; risk.flags.push('INFO_UNAVAILABLE'); }
      if (holders != null && top10Pct != null) {
        await db.tokenHolderMetric.create({ data: { tokenId: t.id, holders, top10Pct, at: now } });
        out.holderRowsWritten++;
      }
      await db.tokenRiskMetric.create({ data: { tokenId: t.id, riskScore: risk.riskScore, flags: risk.flags, at: now } });
      out.riskRowsWritten++;
    }
  }
  await saveResearchDiagnostics(db, 'market', now, out);
  return out;
}

/** NEAR/USD from the last refresh. Throws when it is missing or older than `maxAgeMs`, so callers fail closed. */
export async function readNearUsd(db: PrismaClient, now: Date = new Date(), maxAgeMs = 15 * 60_000): Promise<number> {
  const row = await db.systemSetting.findUnique({ where: { key: NEAR_PRICE_KEY } });
  const v = row?.value as { priceUsd?: unknown; at?: unknown } | null | undefined;
  const price = typeof v?.priceUsd === 'number' && Number.isFinite(v.priceUsd) && v.priceUsd > 0 ? v.priceUsd : null;
  const at = typeof v?.at === 'string' ? new Date(v.at) : null;
  if (price == null || !at || Number.isNaN(at.getTime())) throw new Error('NEAR/USD price is not available');
  if (now.getTime() - at.getTime() > maxAgeMs) throw new Error('NEAR/USD price is stale');
  return price;
}
