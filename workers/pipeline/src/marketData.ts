import type { Prisma, PrismaClient } from '@narra/database';
import { sanitizeUntrusted } from '@narra/shared';
import { MarketDataError, WSOL_MINT, tokenRisk, type LaunchSource, type MarketQuoteSource, type MarketSnapshot, type SnapshotOmissionReason, type TokenInfo, type TokenInfoSource } from '@narra/market-data';
import type { DeveloperHoldingSource } from './developerHoldings';
import {refreshTokenMetadata,type MetadataSource} from './tokenMetadata';
import {discoveryPriceCandidates} from './walletDiscovery';
import { saveResearchDiagnostics } from './researchDiagnostics';

/** Starting values. None is validated against outcomes, and each should become an admin-editable setting. */
export const MARKET_DATA_LIMITS = {
  /** A new pool below this liquidity is ignored, so junk launches never become rows. Opportunities still need 20K. */
  launchMinLiquidityUsd: 5_000,
  maxLaunchesPerRun: 20,
  /** Tokens refreshed per run. Beyond this, the rest wait for the next run (ordered by id, so the same tail can starve). */
  maxTokensPerRun: 150,
  /** Of those, at most this many go to tokens with an early-radar measurement still open (see the refresh set below), so they cannot crowd out everything else. */
  maxEarlyRadarTokensPerRun: 100,
  /** Rotating coverage for completed wallet-discovery scans, within the same total cap. */
  maxDiscoveryTokensPerRun: 25,
  /** Slow-source calls per run. The free GeckoTerminal limit is 30 a minute, so 20 calls take about 45 s. */
  maxInfoCallsPerRun: 20,
  /** How long a token-info lookup (holders, authorities, risk) is reused. */
  infoRefreshMs: 30 * 60_000,
  /** A token with a price row this recent stays in the refresh set. */
  activeWindowMs: 24 * 3_600_000,
  quoteBatch: 30,
} as const;

export const SOL_PRICE_KEY = 'market.solUsd';
export const DISCOVERY_PRICE_CURSOR_KEY = 'market.walletDiscoveryPriceCursor';

export type PriceCoverageLane = 'outcomes' | 'discovery' | 'social' | 'launches' | 'unpriced' | 'general';
export interface PriceCoverageCounts {
  selected: number;
  written: number;
  unavailable: number;
  failed: number;
  notRequested: number;
}

export interface MarketDataDeps {
  metadata?: MetadataSource | null;
  developerHoldings?: DeveloperHoldingSource | null;
  quotes: MarketQuoteSource;
  /** Optional. Without it no holder or risk rows are written, so tokens stay unranked (fail closed). */
  info: TokenInfoSource | null;
  /** Optional. Without it new launches are only found through wallet activity. */
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
  holderRowsWritten: number;
  riskRowsWritten: number;
  solUsd: number | null;
  errors: string[];
}

const errText = (source: string, e: unknown) => `${source}: ${e instanceof MarketDataError ? `${e.kind} (${e.message})` : (e as Error).message}`;
const clean = (s: string, max: number) => sanitizeUntrusted(s, max);

/**
 * Keeps token rows, price rows, holder rows and risk rows current from the market data sources.
 * Rules: a missing price, liquidity, volume or holder figure is never replaced by zero (the row is skipped), token
 * names and symbols are sanitized before storage, and this job only writes research data. It has no access to orders,
 * positions or execution. Source errors are collected in the summary and never stop the other steps.
 */
export async function refreshMarketData(
  db: PrismaClient, deps: MarketDataDeps, now: Date = new Date(),
  opts: { maxTokens?: number; maxInfoCalls?: number } = {},
): Promise<MarketDataSummary> {
  const L = MARKET_DATA_LIMITS;
  const emptyCoverage = (): PriceCoverageCounts => ({ selected: 0, written: 0, unavailable: 0, failed: 0, notRequested: 0 });
  const out: MarketDataSummary = { launchesSeen: 0, tokensCreated: 0, tokensConsidered: 0, tokensWithPrice: 0, tokensWithoutData: 0, priceCoverage: { outcomes: emptyCoverage(), discovery: emptyCoverage(), social: emptyCoverage(), launches: emptyCoverage(), unpriced: emptyCoverage(), general: emptyCoverage() }, priceOmissions: {}, metricsWritten: 0, fdvUsedAsMarketCap: 0, infoCalls: 0, infoUnavailable: 0, holderRowsWritten: 0, riskRowsWritten: 0, solUsd: null, errors: [] };
  if(deps.metadata){try{await refreshTokenMetadata(db,deps.metadata,now);}catch(e){out.errors.push(errText('token metadata',e));}}

  // 1. SOL/USD, kept in one settings row so every later consumer reads the same number.
  try {
    const sol = (await deps.quotes.getSnapshots([WSOL_MINT])).get(WSOL_MINT);
    if (sol) {
      const value = { priceUsd: sol.priceUsd, at: now.toISOString(), source: deps.quotes.name };
      await db.systemSetting.upsert({ where: { key: SOL_PRICE_KEY }, create: { key: SOL_PRICE_KEY, value }, update: { value } });
      out.solUsd = sol.priceUsd;
    } else out.errors.push('sol price: no usable data');
  } catch (e) { out.errors.push(errText('sol price', e)); }

  // 2. Launch detection. New pools with real liquidity become token rows, so a narrative can find a token the moment it exists.
  const launchMints: string[] = [];
  if (deps.launches) {
    try {
      const pools = await deps.launches.getNewPools();
      out.launchesSeen = pools.length;
      for (const p of pools.filter(p=>p.liquidityUsd!=null&&p.liquidityUsd>=L.launchMinLiquidityUsd).slice(0, L.maxLaunchesPerRun)) {
        if (p.liquidityUsd == null || p.liquidityUsd < L.launchMinLiquidityUsd) continue;
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
        } catch (e) { out.errors.push(errText(`launch ${p.mint.slice(0, 6)}`, e)); }
      }
    } catch (e) { out.errors.push(errText(deps.launches.name, e)); }
  }

  // 3. The refresh set: tokens an early-radar outcome is still waiting on, narrative candidates that have no price yet,
  // then placeholders that need a name, fresh launches, recently priced tokens, other narrative candidates and held tokens.
  // The cap below takes ids in order, so without the first group the newest tokens (the ones early-radar alerts are about) starve once the set outgrows the cap, and their 24h and 7d readings are lost.
  const cap = opts.maxTokens ?? L.maxTokensPerRun;
  const tokenSelect = { id: true, mint: true, symbol: true, createdOnChainAt: true, risk: { orderBy: { at: 'desc' }, take: 1, select: { at: true } } } satisfies Prisma.TokenSelect;
  const waiting = await db.earlyRadarMeasurement.findMany({ where: { status: 'PENDING' }, orderBy: [{ nextCheckAt: 'asc' }, { id: 'asc' }], take: 500, select: { outcome: { select: { tokenId: true } } } });
  const priorityIds = [...new Set(waiting.map((w) => w.outcome.tokenId))].slice(0, Math.min(L.maxEarlyRadarTokensPerRun, cap));
  const priority = priorityIds.length
    ? await db.token.findMany({ where: { id: { in: priorityIds }, blacklisted: false, mint: { not: WSOL_MINT } }, orderBy: { id: 'asc' }, take: cap, select: tokenSelect })
    : [];
  // Discovery cannot judge early buyers without both an initial and a later price.
  // Reserve at most half the remaining slots and rotate, including tokens already priced.
  const cursorRow = await db.systemSetting.findUnique({ where: { key: DISCOVERY_PRICE_CURSOR_KEY } });
  const cursor = typeof cursorRow?.value === 'string' ? cursorRow.value : null;
  const discoveryIds = await discoveryPriceCandidates(db, now, Math.min(L.maxDiscoveryTokensPerRun, Math.floor((cap - priority.length) / 2)), priority.map(t => t.id), cursor);
  const discovery = discoveryIds.length ? await db.token.findMany({ where: { id: { in: discoveryIds } }, select: tokenSelect }) : [];
  const reservedIds = [...priority, ...discovery].map(t => t.id);
  // A token with no price row at all is invisible to every screen, and the id-ordered cap below would take older ids
  // first, so a freshly linked candidate could age out of the set before its first reading. Give unpriced narrative
  // candidates a first price ahead of the general set, newest token id first. Reserve room for established tokens too.
  const unpriced = reservedIds.length >= cap ? [] : await db.token.findMany({
    where: { blacklisted: false, mint: { not: WSOL_MINT }, id: { notIn: reservedIds }, metrics: { none: {} }, narratives: { some: {} } },
    orderBy: { id: 'desc' }, take: Math.ceil((cap - reservedIds.length) / 2), select: tokenSelect,
  });
  const takenIds = [...reservedIds, ...unpriced.map(t => t.id)];
  const rest = takenIds.length >= cap ? [] : await db.token.findMany({
    where: {
      blacklisted: false, mint: { not: WSOL_MINT }, id: { notIn: takenIds },
      OR: [
        { symbol: 'UNKNOWN' }, { mint: { in: launchMints } },
         { metrics: { some: { at: { gte: new Date(now.getTime() - L.activeWindowMs) } } } },
         // Resolving a wallet token's name must not remove it from market-price collection.
         { walletTrades: { some: { at: { gte: new Date(now.getTime() - L.activeWindowMs) } } } },
        { narratives: { some: {} } }, { positions: { some: {} } },
      ],
    },
    orderBy: { id: 'asc' }, take: cap - takenIds.length, select: tokenSelect,
  });
  const tokens = [...priority, ...discovery, ...unpriced, ...rest];
  out.tokensConsidered = tokens.length;

  // 4. Prices. One batch failing does not lose the others, and a 429 stops the step.
  const snaps = new Map<string, MarketSnapshot>();
  // Diagnostic request state is separate from cursor advancement (throttled batches must retry).
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
  const lanes: Record<PriceCoverageLane, typeof tokens> = {
    outcomes: priority, discovery, social: [], launches: rest.filter(t => launchSet.has(t.mint)), unpriced,
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
      }
      else if (requests.get(token.mint) === 'failed') counts.failed++;
      else counts.notRequested++;
    }
  }
  for (const t of tokens) {
    const s = snaps.get(t.mint);
    if (!s) { out.tokensWithoutData++; continue; }
    out.tokensWithPrice++;
    // Tie provider provenance to the exact metric row. Older/imported rows never inherit this trust.
    await db.$transaction(async tx => {
      const metric = await tx.tokenMetric.create({ data: { tokenId: t.id, priceUsd: s.priceUsd, marketCapUsd: s.marketCapUsd, liquidityUsd: s.liquidityUsd, volume24hUsd: s.volume24hUsd, at: now } });
      const value = { metricId: metric.id, at: now.toISOString(), source: deps.quotes.name, marketCapIsFdv: s.marketCapIsFdv, priceChange1hPct: s.priceChange1hPct, pairAddress: s.pairAddress, dexId: s.dexId, pairCreatedAt: s.pairCreatedAt?.toISOString() ?? null };
      const key = `research.market.${t.id}`;
       await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
       // Keep per-observation provenance for the price-history view. Legacy rows are never retroactively trusted.
       const historyKey = `research.marketMetric.${metric.id}`;
       await tx.systemSetting.create({ data: { key: historyKey, value } });
    });
    out.metricsWritten++;
    if (s.marketCapIsFdv) out.fdvUsedAsMarketCap++;
    const patch: Prisma.TokenUpdateInput = {};
    const symbol = clean(s.symbol, 32);
    if (t.symbol === 'UNKNOWN' && symbol) { patch.symbol = symbol; patch.name = clean(s.name, 64) || symbol; }
    // Pool creation is the earliest on-chain time the free sources give. It is a proxy for token age, not the mint time.
    if (!t.createdOnChainAt && s.pairCreatedAt) patch.createdOnChainAt = s.pairCreatedAt;
    if (Object.keys(patch).length) await db.token.update({ where: { id: t.id }, data: patch });
  }

  // 5. Holders and risk. Original issuing-wallet balances are measured separately through RPC where supported;
  // missing or failed attribution remains unknown, never zero.
  if (deps.info) {
    const due = tokens
      .filter((t) => snaps.has(t.mint) && (!t.risk[0] || now.getTime() - t.risk[0].at.getTime() >= L.infoRefreshMs))
      .sort((a, b) => (a.risk[0]?.at.getTime() ?? 0) - (b.risk[0]?.at.getTime() ?? 0))
      .slice(0, opts.maxInfoCalls ?? L.maxInfoCallsPerRun);
    let developerLookups = 0;
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
      const created = t.createdOnChainAt ?? s.pairCreatedAt;
      let devHoldingPct: number | null = null;
      if (deps.developerHoldings && developerLookups++ < 3) {
        try {
          const holding = await deps.developerHoldings.getHolding(t.mint);
          if (holding) {
            devHoldingPct = holding.holdingPct;
            const key = `research.developerHolding.${t.id}`;
            const value = { ...holding, at: now.toISOString(), relatedWalletsIncluded: false };
            await db.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
          }
        } catch (e) { out.errors.push(errText('developer holdings', e)); }
      }
      const pairAgeMinutes = created ? (now.getTime() - created.getTime()) / 60_000 : null;
      const risk = tokenRisk({
        liquidityUsd: s.liquidityUsd, holders: info?.holders ?? null, top10Pct: info?.top10Pct ?? null, devHoldingPct,
        mintAuthorityActive: info?.mintAuthorityActive ?? null, freezeAuthorityActive: info?.freezeAuthorityActive ?? null,
        isHoneypot: info?.isHoneypot ?? null, pairAgeMinutes,
      });
      if (!info) { out.infoUnavailable++; risk.flags.push('INFO_UNAVAILABLE'); }
      // A holder row needs both numbers. With either missing, nothing is written and the token stays unranked.
      if (info && info.holders != null && info.top10Pct != null) {
        await db.tokenHolderMetric.create({ data: { tokenId: t.id, holders: info.holders, top10Pct: info.top10Pct, devHoldingPct, at: now } });
        out.holderRowsWritten++;
      }
      await db.tokenRiskMetric.create({ data: { tokenId: t.id, riskScore: risk.riskScore, flags: risk.flags, at: now } });
      out.riskRowsWritten++;
    }
  }
  if (discoveryIds.length) {
    const value = discoveryIds[discoveryIds.length - 1]!;
    await db.systemSetting.upsert({ where: { key: DISCOVERY_PRICE_CURSOR_KEY }, create: { key: DISCOVERY_PRICE_CURSOR_KEY, value }, update: { value } });
  }
  await saveResearchDiagnostics(db, 'market', now, out);
  return out;
}

/** SOL/USD from the last refresh. Throws when it is missing or older than `maxAgeMs`, so callers fail closed. */
export async function readSolUsd(db: PrismaClient, now: Date = new Date(), maxAgeMs = 15 * 60_000): Promise<number> {
  const row = await db.systemSetting.findUnique({ where: { key: SOL_PRICE_KEY } });
  const v = row?.value as { priceUsd?: unknown; at?: unknown } | null | undefined;
  const price = typeof v?.priceUsd === 'number' && Number.isFinite(v.priceUsd) && v.priceUsd > 0 ? v.priceUsd : null;
  const at = typeof v?.at === 'string' ? new Date(v.at) : null;
  if (price == null || !at || Number.isNaN(at.getTime())) throw new Error('SOL/USD price is not available');
  if (now.getTime() - at.getTime() > maxAgeMs) throw new Error('SOL/USD price is stale');
  return price;
}
