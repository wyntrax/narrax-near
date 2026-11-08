/**
 * Smart-money accounting for observed NEAR DEX trades.
 *
 * This is deliberately a research calculation, not a claim of complete wallet history:
 *  - only trades this deployment observed are used;
 *  - a sell is priced only when its cost basis came from an observed buy;
 *  - open positions are not marked to market;
 *  - a sell larger than the observed position is kept for the observed units and flagged.
 *
 * Every number is USD as reported by the trade source at trade time. No current price is
 * substituted for a historical trade value.
 */

export interface SmartTradeRow {
  token: string;
  side: 'BUY' | 'SELL';
  /** Token units received on a buy, sent on a sell. */
  tokenAmount: number;
  /** USD value of that side of the swap at trade time. */
  valueUsd: number;
  at: Date;
}

export interface SmartClosedLeg {
  token: string;
  pnlUsd: number;
  costUsd: number;
  roi: number;
  holdSeconds: number;
  closedAt: Date;
}

export interface SmartWalletStats {
  legs: SmartClosedLeg[];
  /** Sells with no earlier observed buy. Their basis is unknown and they are excluded from PnL. */
  unmatchedSells: number;
  /** Number of sell events larger than the observed position. The observed part still counts. */
  excessSellUnits: number;
  totalBoughtUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  pnlUsd: number;
  winRate: number | null;
  avgRoi: number | null;
  medianRoi: number | null;
  medianHoldSeconds: number | null;
  /** Largest peak-to-trough fall in cumulative realized PnL, divided by all observed buys. */
  maxDrawdown: number;
  grossWinUsd: number;
  grossLossUsd: number;
  profitFactor: number | null;
  observedFrom: Date | null;
  observedTo: Date | null;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  tokensTraded: number;
  closedTokens: number;
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const EPS = 1e-9;
const finitePositive = (n: number) => Number.isFinite(n) && n > 0;

/**
 * Average-cost accounting for one wallet. Trades are ordered by time (source order breaks ties).
 * A sell realizes proceeds minus the average cost of the units sold.
 */
export function computeSmartWalletStats(trades: SmartTradeRow[]): SmartWalletStats {
  const sorted = trades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => a.trade.at.getTime() - b.trade.at.getTime() || a.index - b.index)
    .map(({ trade }) => trade);

  const book = new Map<string, { qty: number; cost: number; openedAt: Date }>();
  const legs: SmartClosedLeg[] = [];
  let unmatchedSells = 0;
  let excessSellUnits = 0;
  let totalBoughtUsd = 0;
  let buyVolumeUsd = 0;
  let sellVolumeUsd = 0;
  const tokens = new Set<string>();

  for (const trade of sorted) {
    if (!finitePositive(trade.tokenAmount)) continue;
    if (!Number.isFinite(trade.valueUsd) || trade.valueUsd < 0) continue;
    tokens.add(trade.token);
    const held = book.get(trade.token);

    if (trade.side === 'BUY') {
      buyVolumeUsd += trade.valueUsd;
      totalBoughtUsd += trade.valueUsd;
      const next = held ?? { qty: 0, cost: 0, openedAt: trade.at };
      if (next.qty <= EPS) next.openedAt = trade.at;
      next.qty += trade.tokenAmount;
      next.cost += trade.valueUsd;
      book.set(trade.token, next);
      continue;
    }

    sellVolumeUsd += trade.valueUsd;
    if (!held || held.qty <= EPS) {
      unmatchedSells++;
      continue;
    }

    const soldQty = Math.min(trade.tokenAmount, held.qty);
    if (trade.tokenAmount > held.qty + Math.max(EPS, held.qty * EPS)) excessSellUnits++;
    const fraction = soldQty / held.qty;
    const costUsd = held.cost * fraction;
    const proceedsUsd = trade.valueUsd * (soldQty / trade.tokenAmount);
    const pnlUsd = proceedsUsd - costUsd;
    legs.push({
      token: trade.token,
      pnlUsd,
      costUsd,
      roi: costUsd > 0 ? pnlUsd / costUsd : 0,
      holdSeconds: (trade.at.getTime() - held.openedAt.getTime()) / 1000,
      closedAt: trade.at,
    });

    held.qty -= soldQty;
    held.cost -= costUsd;
    if (held.qty <= EPS) {
      held.qty = 0;
      held.cost = 0;
    }
  }

  const wins = legs.filter((leg) => leg.pnlUsd > 0);
  const losses = legs.filter((leg) => leg.pnlUsd < 0);
  const grossWinUsd = wins.reduce((sum, leg) => sum + leg.pnlUsd, 0);
  const grossLossUsd = losses.reduce((sum, leg) => sum - leg.pnlUsd, 0);
  let cumulative = 0;
  let peak = 0;
  let maxDrawdownUsd = 0;
  for (const leg of legs) {
    cumulative += leg.pnlUsd;
    peak = Math.max(peak, cumulative);
    maxDrawdownUsd = Math.max(maxDrawdownUsd, peak - cumulative);
  }

  const observedFrom = sorted.length ? sorted[0]!.at : null;
  const observedTo = sorted.length ? sorted[sorted.length - 1]!.at : null;
  return {
    legs,
    unmatchedSells,
    excessSellUnits,
    totalBoughtUsd,
    buyVolumeUsd,
    sellVolumeUsd,
    pnlUsd: grossWinUsd - grossLossUsd,
    winRate: legs.length ? wins.length / legs.length : null,
    avgRoi: legs.length ? legs.reduce((sum, leg) => sum + leg.roi, 0) / legs.length : null,
    medianRoi: median(legs.map((leg) => leg.roi)),
    medianHoldSeconds: median(legs.map((leg) => leg.holdSeconds)),
    maxDrawdown: totalBoughtUsd > 0 ? Math.min(1, maxDrawdownUsd / totalBoughtUsd) : 0,
    grossWinUsd,
    grossLossUsd,
    profitFactor: grossLossUsd > 0 ? grossWinUsd / grossLossUsd : grossWinUsd > 0 ? 4 : null,
    observedFrom,
    observedTo,
    tradeCount: sorted.length,
    buyCount: sorted.filter((trade) => trade.side === 'BUY').length,
    sellCount: sorted.filter((trade) => trade.side === 'SELL').length,
    tokensTraded: tokens.size,
    closedTokens: new Set(legs.map((leg) => leg.token)).size,
  };
}

/** A wallet needs this many closed legs before a score exists at all. */
export const SMART_MONEY_MIN_CLOSED_LEGS = 5;

/** Lower end of the 95% confidence interval for a win rate. Small samples score low on purpose. */
export function wilsonLowerBound(wins: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = wins / n;
  const denominator = 1 + (z * z) / n;
  return Math.max(0, (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator);
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Wallet score 0 to 100. Quality uses the lower-bound win rate, median ROI, profit factor and
 * drawdown. The track-record multiplier grows from 0.6 to 1.0 over 20 closed legs; sample size
 * only discounts a record, it never adds points.
 */
export function smartWalletScore(stats: SmartWalletStats): number | null {
  const n = stats.legs.length;
  if (n < SMART_MONEY_MIN_CLOSED_LEGS) return null;
  const wins = stats.legs.filter((leg) => leg.pnlUsd > 0).length;
  const profitFactor = stats.profitFactor ?? 0;
  const quality =
    0.35 * wilsonLowerBound(wins, n) +
    0.30 * (clamp(stats.medianRoi ?? 0, 0, 2) / 2) +
    0.20 * (Math.min(profitFactor, 4) / 4) +
    0.15 * (1 - clamp(stats.maxDrawdown, 0, 1));
  return Math.round(quality * (0.6 + 0.4 * Math.min(n / 20, 1)) * 1000) / 10;
}

export interface SmartMoneyRules {
  minClosedTrades: number;
  minClosedTokens: number;
  minObservedHours: number;
  minVolumeUsd: number;
  minScore: number;
  maxUnmatchedSells: number;
  maxExcessSellUnits: number;
  requirePositivePnl: boolean;
  requirePositiveMedianRoi: boolean;
}

/** Starting admission values, not validated predictions. All thresholds are visible to the API/UI. */
export const SMART_MONEY_RULES: SmartMoneyRules = {
  minClosedTrades: 5,
  minClosedTokens: 2,
  minObservedHours: 24,
  minVolumeUsd: 100,
  minScore: 60,
  maxUnmatchedSells: 0,
  maxExcessSellUnits: 0,
  requirePositivePnl: true,
  requirePositiveMedianRoi: true,
};

export type SmartWalletStatus = 'QUALIFIED' | 'PROVISIONAL' | 'INSUFFICIENT';

export interface SmartProfileAssessment {
  status: SmartWalletStatus;
  eligible: boolean;
  reasons: string[];
}

export const SMART_INSUFFICIENT_REASONS = new Set([
  'TOO_FEW_CLOSED_TRADES',
  'TOO_FEW_CLOSED_TOKENS',
  'SHORT_OBSERVATION',
  'VOLUME_BELOW_MINIMUM',
  'INCOMPLETE_COST_BASIS',
  'NO_SCORE',
]);

/** Assess a profile from stored observations. Unknown or incomplete evidence fails closed. */
export function assessSmartWallet(
  stats: SmartWalletStats,
  score: number | null,
  rules: SmartMoneyRules = SMART_MONEY_RULES,
): SmartProfileAssessment {
  const reasons: string[] = [];
  const observedHours = stats.observedFrom && stats.observedTo
    ? Math.max(0, (stats.observedTo.getTime() - stats.observedFrom.getTime()) / 3_600_000)
    : 0;

  if (stats.legs.length < rules.minClosedTrades) reasons.push('TOO_FEW_CLOSED_TRADES');
  if (stats.closedTokens < rules.minClosedTokens) reasons.push('TOO_FEW_CLOSED_TOKENS');
  if (observedHours < rules.minObservedHours) reasons.push('SHORT_OBSERVATION');
  if (stats.buyVolumeUsd + stats.sellVolumeUsd < rules.minVolumeUsd) reasons.push('VOLUME_BELOW_MINIMUM');
  if (stats.unmatchedSells > rules.maxUnmatchedSells || stats.excessSellUnits > rules.maxExcessSellUnits) reasons.push('INCOMPLETE_COST_BASIS');
  if (score == null) reasons.push('NO_SCORE');
  if (score != null && score < rules.minScore) reasons.push('SCORE_BELOW_MINIMUM');
  if (rules.requirePositivePnl && !(stats.pnlUsd > 0)) reasons.push('NEGATIVE_PNL');
  if (rules.requirePositiveMedianRoi && !((stats.medianRoi ?? 0) > 0)) reasons.push('NEGATIVE_MEDIAN_ROI');

  const eligible = reasons.length === 0;
  const status: SmartWalletStatus = eligible
    ? 'QUALIFIED'
    : reasons.some((reason) => SMART_INSUFFICIENT_REASONS.has(reason))
      ? 'INSUFFICIENT'
      : 'PROVISIONAL';
  return { status, eligible, reasons };
}
