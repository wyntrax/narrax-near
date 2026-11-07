import { Prisma, type PrismaClient } from '@narra/database';
import { WalletPerformance, type WalletEntryBand } from '@narra/shared';
import { computeWalletPerformance, type PerformanceTrade } from '@narra/worker-pipeline';

const obj = (v: unknown): Record<string,unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string,unknown> : {};
const fresh = (v: unknown, now: Date, age: number) => typeof v === 'string' && Date.parse(v) <= +now && +now-Date.parse(v) <= age;

/** Review reasons are descriptive. They do not promote a wallet, approve it, or predict returns. */
export function rankingReasons(performance: WalletPerformance, band: WalletPerformance['bands'][number], history: unknown, now: Date, linked: boolean, developer: boolean, minMedianPositionSol = 0.01) {
  const h = obj(history), reasons: string[] = [];
  const historyComplete = h.capped === false && h.skipped === 0 && h.windowDays === 30 && fresh(h.checkedAt,now,86_400_000) &&
    fresh(h.coveredTo,now,86_400_000) && typeof h.coveredFrom === 'string' && typeof h.coveredTo === 'string' &&
    Date.parse(h.coveredTo)-Date.parse(h.coveredFrom)>=30*86_400_000;
  if (!historyComplete) reasons.push('HISTORY_INCOMPLETE');
  if (!fresh(performance.checkedAt,now,45*60_000)) reasons.push('PERFORMANCE_STALE');
  if (!fresh(performance.lastTradeAt,now,86_400_000)) reasons.push('ACTIVITY_STALE');
  if (performance.capped) reasons.push('TRADE_LIMIT');
  if (performance.invalidTrades || performance.unmatchedSells) reasons.push('INCOMPLETE_COST_BASIS');
  if (band.closedPositions<20 || band.closedTokens<5 || band.observedDays<7) reasons.push('SMALL_SAMPLE');
  if (band.medianClosedPositionSol == null) reasons.push('POSITION_SIZE_UNKNOWN');
  else if (new Prisma.Decimal(band.medianClosedPositionSol).lt(minMedianPositionSol)) reasons.push('SMALL_POSITIONS');
  if (band.realisedPnlSol===null || new Prisma.Decimal(band.realisedPnlSol).lte(0) || (band.medianRoi??0)<=0) reasons.push('POSITIVE_RESULTS_REQUIRED');
  if ((band.winRateLowerBound??0)<0.5) reasons.push('LOW_WIN_CONFIDENCE');
  if (band.band==='UNKNOWN' || band.band==='ALL' || band.band==='OVER_1M') reasons.push('SMALL_CAP_UNPROVEN');
  if ((band.fastCloseRate??0)>0.5) reasons.push('FAST_EXITS');
  if (linked) reasons.push('LINKED_WALLETS');
  if (developer) reasons.push('KNOWN_DEPLOYER');
  return { historyComplete, reasons };
}

/**
 * Bounded leaderboard over active tracked wallets. Performance is computed from recorded
 * native-amount swaps; a wallet with no stored evaluation is computed on demand, capped at
 * 10,000 trades. No token growth, provider price or operator review promotes a wallet.
 */
export async function walletRanking(db: PrismaClient, now: Date, band: WalletEntryBand, limit: number, status: 'ALL' | 'REVIEW_READY' | 'OBSERVING' = 'ALL', minMedianPositionSol = 0.01) {
  const wallets = await db.trackedWallet.findMany({
    where: { active: true }, orderBy: { id: 'asc' }, take: 101,
    select: { id: true, address: true, label: true, clusterId: true },
  });
  const cohort = wallets.slice(0, 100);
  const history = await db.systemSetting.findMany({ where: { key: { in: cohort.map(w => `wallet.history.${w.id}`) } }, select: { key: true, value: true } });
  const historyByKey = new Map(history.map(row => [row.key, row.value]));
  const developers = cohort.length ? await db.token.findMany({ where: { deployer: { in: cohort.map(w => w.address) } }, distinct: ['deployer'], select: { deployer: true } }) : [];
  const devs = new Set(developers.map(t => t.deployer));
  const items = [];
  for (const w of cohort) {
    const rows = await db.walletTrade.findMany({
      where: { walletId: w.id, at: { gte: new Date(+now - 30 * 86_400_000), lte: now } },
      orderBy: [{ at: 'asc' }, { id: 'asc' }], take: 10_001,
      select: { id: true, tokenId: true, side: true, amountSol: true, tokenAmount: true, marketCapUsd: true, evidence: true, at: true },
    });
    const performance = computeWalletPerformance(rows.slice(0, 10_000) as PerformanceTrade[], now, rows.length > 10_000);
    const selected = performance.bands.find(b => b.band === band);
    if (!selected?.positions) continue;
    if (minMedianPositionSol > 0 && (selected.medianClosedPositionSol == null ||
      new Prisma.Decimal(selected.medianClosedPositionSol).lt(minMedianPositionSol))) continue;
    const linked = w.clusterId !== null, developer = devs.has(w.address);
    const { reasons, historyComplete } = rankingReasons(performance, selected, historyByKey.get(`wallet.history.${w.id}`), now, linked, developer, minMedianPositionSol);
    items.push({
      address: w.address, label: w.label, review: 'UNREVIEWED', status: reasons.length ? 'OBSERVING' as const : 'REVIEW_READY' as const,
      reasons, historyComplete, linked, developer, checkedAt: performance.checkedAt, performance: selected,
    });
  }
  items.sort((a,b) => Number(b.status === 'REVIEW_READY') - Number(a.status === 'REVIEW_READY') ||
    Number(b.historyComplete) - Number(a.historyComplete) ||
    (b.performance.winRateLowerBound ?? -1) - (a.performance.winRateLowerBound ?? -1) ||
    new Prisma.Decimal(b.performance.realisedPnlSol ?? '0').cmp(a.performance.realisedPnlSol ?? '0') || a.address.localeCompare(b.address));
  const counts = { reviewReady: items.filter(w => w.status === 'REVIEW_READY').length, observing: items.filter(w => w.status === 'OBSERVING').length };
  const filtered = items.filter(w => status === 'ALL' || w.status === status);
  return {
    asOf: now.toISOString(), band, windowDays: 30 as const, total: filtered.length,
    capped: wallets.length > 100 || filtered.length > limit, minMedianPositionSol, counts, pipeline: null,
    items: filtered.slice(0, limit),
  };
}
