import type { PrismaClient } from '@narra/database';
import { sanitizeUntrusted } from '@narra/shared';
import { SOCIAL_RULES, computeNarrativeMetrics, groupBuzz, qualifiedBuzz, type BuzzGroup } from '@narra/narrative';
import { EARLY_RULES, attentionPriceDivergence, evaluateEarlyBoth } from '@narra/token-intel';
import { NEAR_REFERENCE_CONTRACTS, type MarketQuoteSource } from '@narra/market-data';
import { createEarlyRadarAlert } from './earlyRadarTracking';

export interface SocialScanSummary {
  rowsRead: number;
  groupsQualified: number;
  tokensCreated: number;
  /** Contracts people posted that no market source knows (new, no pool, or a pool address). Nothing is created for these. */
  mintsUnverified: number;
  cashtagsResolved: number;
  /** Cashtags with zero or several matching tokens. Left out on purpose: a symbol alone cannot name one token. */
  cashtagsAmbiguous: number;
  tokensEvaluated: number;
  earlyCandidates: number;
  alerts: number;
  pruned: number;
  errors: string[];
}

const HOUR = 3_600_000;
const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));

/**
 * Finds small tokens from social chatter instead of from a narrative's name. Reads the stored token references
 * (mints and $TICKERS counted by ingestion), keeps those posted by enough distinct accounts, resolves them to
 * tokens, and runs the early radar on them with the chatter's own attention score.
 *
 * Safety: research only. It writes token rows, alerts and prunes old mentions. It has no access to orders,
 * positions or execution. Social text is attacker-controlled, so a new token row is created only when a real
 * market source confirms the mint trades and is under the early market cap ceiling, at most a few per run.
 * A cashtag resolves only when exactly one known token carries that symbol. Anything else is skipped, not guessed.
 */
export async function scanSocialTokens(db: PrismaClient, deps: { quotes: MarketQuoteSource | null }, now: Date = new Date()): Promise<SocialScanSummary> {
  const R = SOCIAL_RULES;
  const out: SocialScanSummary = { rowsRead: 0, groupsQualified: 0, tokensCreated: 0, mintsUnverified: 0, cashtagsResolved: 0, cashtagsAmbiguous: 0, tokensEvaluated: 0, earlyCandidates: 0, alerts: 0, pruned: 0, errors: [] };

  out.pruned = (await db.tokenMention.deleteMany({ where: { at: { lt: new Date(now.getTime() - R.retentionDays * 24 * HOUR) } } })).count;

  const since = new Date(now.getTime() - R.lookbackHours * HOUR);
  const rows = await db.tokenMention.findMany({ where: { at: { gte: since, lte: now } }, orderBy: { at: 'desc' }, take: R.maxRows });
  out.rowsRead = rows.length;
  const groups = qualifiedBuzz(groupBuzz(rows), R);
  out.groupsQualified = groups.length;
  if (!groups.length) return out;

  // 1. Resolve each qualified reference to a token id. A mint wins over a cashtag for the same token.
  const resolved = new Map<string, { group: BuzzGroup; via: 'CONTRACT' | 'CASHTAG' }>();
  const unknownMints: BuzzGroup[] = [];
  let cashtagLookups = 0;
  for (const g of groups) {
    if (g.kind === 'CONTRACT') {
      if (NEAR_REFERENCE_CONTRACTS.has(g.ref)) continue;
      const t = await db.token.findUnique({ where: { mint: g.ref }, select: { id: true, blacklisted: true } });
      if (t?.blacklisted) continue;
      if (t) resolved.set(t.id, { group: g, via: 'CONTRACT' }); else unknownMints.push(g);
    } else {
      if (cashtagLookups++ >= R.maxCashtagLookupsPerRun) continue;
      const matches = await db.token.findMany({
        where: { symbol: { equals: g.ref, mode: 'insensitive' }, blacklisted: false, metrics: { some: { at: { gte: new Date(now.getTime() - 24 * HOUR) } } } },
        select: { id: true }, take: 2,
      });
      if (matches.length !== 1) { out.cashtagsAmbiguous++; continue; }
      out.cashtagsResolved++;
      if (!resolved.has(matches[0]!.id)) resolved.set(matches[0]!.id, { group: g, via: 'CASHTAG' });
    }
  }

  // 2. Unknown mints become tokens only after a market source confirms they trade and are small enough to matter here.
  if (unknownMints.length && deps.quotes) {
    const wanted = unknownMints.slice(0, R.maxNewTokensPerRun * 3);
    let snaps: Awaited<ReturnType<MarketQuoteSource['getSnapshots']>> = new Map();
    try { snaps = await deps.quotes.getSnapshots(wanted.map((g) => g.ref)); } catch (e) { out.errors.push(`quotes: ${(e as Error).message}`.slice(0, 200)); }
    for (const g of wanted) {
      const s = snaps.get(g.ref);
      if (!s || !(s.marketCapUsd < EARLY_RULES.maxMarketCapUsd)) { out.mintsUnverified++; continue; }
      if (out.tokensCreated >= R.maxNewTokensPerRun) break;
      try {
        const symbol = sanitizeUntrusted(s.symbol, 32), name = sanitizeUntrusted(s.name, 64);
        const t = await db.token.create({ data: { mint: g.ref, symbol: symbol || 'UNKNOWN', name: name || 'Unknown', createdOnChainAt: s.pairCreatedAt }, select: { id: true } });
        out.tokensCreated++;
        resolved.set(t.id, { group: g, via: 'CONTRACT' });
      } catch (e) { out.errors.push(`create ${g.ref.slice(0, 6)}: ${(e as Error).message}`.slice(0, 200)); }
    }
  } else out.mintsUnverified += unknownMints.length;

  // 3. Score each resolved token. A token without a stored price or holder row is skipped until market data fills it in.
  for (const [tokenId, { group, via }] of resolved) {
    const t = await db.token.findUnique({
      where: { id: tokenId },
      include: { metrics: { orderBy: { at: 'desc' }, take: 1 }, holders: { orderBy: { at: 'desc' }, take: 1 }, risk: { orderBy: { at: 'desc' }, take: 1 } },
    });
    const m = t?.metrics[0], h = t?.holders[0];
    if (!t || !m || !h) continue;
    const marketCapUsd = num(m.marketCapUsd);
    if (marketCapUsd == null || marketCapUsd >= EARLY_RULES.maxMarketCapUsd) continue;
    out.tokensEvaluated++;

    const liquidityUsd = num(m.liquidityUsd) ?? NaN;
    const price = num(m.priceUsd) ?? 0;
    const priceAt = async (hoursAgo: number) => num((await db.tokenMetric.findFirst({ where: { tokenId, at: { lte: new Date(now.getTime() - hoursAgo * HOUR) } }, orderBy: { at: 'desc' }, select: { priceUsd: true } }))?.priceUsd);
    const [p1, p3] = await Promise.all([priceAt(1), priceAt(3)]);
    const growth = (then: number | null) => (then && then > 0 ? (price / then - 1) * 100 : null);
    const growth1h = growth(p1), growth3h = growth(p3);
    const thenRow = await db.tokenHolderMetric.findFirst({ where: { tokenId, at: { lte: new Date(now.getTime() - 3 * HOUR) } }, orderBy: { at: 'desc' }, select: { holders: true } });

    // The chatter about this one token is scored like a narrative: velocity, organic quality (copy-paste and burst checks) and stage.
    const c = computeNarrativeMetrics(group.points, now);
    const divergence = attentionPriceDivergence(c.mentionVelocity, growth3h);
    const early = evaluateEarlyBoth({
      marketCapUsd, liquidityUsd, volume24hUsd: num(m.volume24hUsd) ?? NaN, holders: h.holders, holdersThen: thenRow?.holders ?? null,
      top10Pct: h.top10Pct,
      tokenAgeMinutes: t.createdOnChainAt ? (now.getTime() - t.createdOnChainAt.getTime()) / 60_000 : null,
      relation: 'UNKNOWN', ogScore: null, symbolOnlyMatch: via === 'CASHTAG', narrativeScore: c.score, narrativeStage: c.stage,
      narrativeManipulationRisk: c.organicKnown ? c.manipulationRisk : null, divergence: divergence.label, priceGrowth1hPct: growth1h,
      riskFlags: t.risk[0]?.flags ?? [],
    });

    let counted = false;
    for (const profile of ['trencher', 'holder'] as const) {
      const e = early[profile];
      if (!e.eligible || (e.tier !== 'WATCH' && e.tier !== 'STRONG')) continue;
      counted = true;
      const kind = profile === 'trencher' ? 'EARLY_RADAR_TRENCHER' : 'EARLY_RADAR_HOLDER';
      // Shared with the narrative path: one alert per token per profile per 6 hours, whichever route found it.
      if (await db.alert.count({ where: { kind, refId: tokenId, createdAt: { gte: new Date(now.getTime() - 6 * HOUR) } } })) continue;
      const k = (v: number) => `$${Math.round(v / 1000)}K`;
      const created=await createEarlyRadarAlert(db,{
        tokenId,mint:t.mint,alertedAt:now,profile,tier:e.tier,route:'SOCIAL',matchKind:via==='CONTRACT'?'CONTRACT':'TICKER_ONLY',score:e.score,metricId:m.id,
        title: `${t.symbol}: early ${profile} candidate from social buzz (${k(marketCapUsd)} cap)`,
        body: `${profile} score ${e.score} (${e.tier.toLowerCase()}). ${group.creators} accounts, ${group.points.length} posts named it in ${R.lookbackHours}h, found by ${via === 'CONTRACT' ? 'contract address' : 'ticker only, so a copycat is possible'}. Market cap ${k(marketCapUsd)}, liquidity ${k(liquidityUsd)}, ${h.holders} holders, top 10 hold ${Math.round(h.top10Pct)}%${e.flags.length ? `. Cautions: ${e.flags.join(', ')}` : ''}. Research signal only, not a prediction or a recommendation to buy.`,
      });
      if(created)out.alerts++;
    }
    if (counted) out.earlyCandidates++;
  }
  return out;
}
