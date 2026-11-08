/**
 * Smart-money observation worker.
 *
 * Source: GeckoTerminal's public NEAR pool trade feed. It is a recent window, not full history.
 * The worker stores only trades that match a token in this deployment's research universe, then
 * recomputes an average-cost profile for every affected wallet. No private keys, signing or orders.
 */
import type { PrismaClient } from '@narra/database';
import { MarketDataError, NEAR_REFERENCE_CONTRACTS, type PoolTradeSource } from '@narra/market-data';
import {
  assessSmartWallet, computeSmartWalletStats, smartWalletScore, SMART_MONEY_RULES,
  type SmartMoneyRules, type SmartTradeRow,
} from '@narra/token-intel';
import { isNearAccountId } from '@narra/shared';

export const SMART_MONEY_HEALTH_KEY = 'research.smartMoney.health';
export const SMART_MONEY_DEFAULTS = {
  maxPools: 20,
  intervalMs: 10 * 60_000,
  maxTradeAgeHours: 48,
} as const;

export interface AccountKindSource {
  /** True for a contract account. Null/throw means the kind could not be established. */
  isContract(address: string): Promise<boolean>;
}

export interface SmartMoneyDeps {
  trades: PoolTradeSource;
  /** Mainnet RPC check that keeps routers/contracts out of user-wallet research. */
  accountKind?: AccountKindSource;
  maxPools?: number;
  rules?: SmartMoneyRules;
  now?: Date;
}

export interface SmartMoneySummary {
  pools: number;
  tradesSeen: number;
  tradesStored: number;
  walletsTouched: number;
  profiles: number;
  contractsExcluded: number;
  accountChecksFailed: number;
  errors: string[];
  source: string;
}

interface CandidateToken {
  id: string;
  mint: string;
  symbol: string;
  liquidityUsd: number;
  pairAddress: string;
}

interface NormalizedTrade {
  wallet: string;
  tokenId: string;
  source: string;
  externalId: string;
  poolAddress: string;
  txHash: string;
  side: 'BUY' | 'SELL';
  tokenAmount: number;
  priceUsd: number | null;
  valueUsd: number;
  at: Date;
}

const envNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

/** Rules are operator-visible and never silently loosen when a variable is malformed. */
export function smartMoneyRulesFromEnv(env: Record<string, string | undefined> = process.env): SmartMoneyRules {
  return {
    ...SMART_MONEY_RULES,
    minClosedTrades: envNumber('SMART_MONEY_MIN_CLOSED_TRADES', SMART_MONEY_RULES.minClosedTrades),
    minClosedTokens: envNumber('SMART_MONEY_MIN_CLOSED_TOKENS', SMART_MONEY_RULES.minClosedTokens),
    minObservedHours: envNumber('SMART_MONEY_MIN_OBSERVED_HOURS', SMART_MONEY_RULES.minObservedHours),
    minVolumeUsd: envNumber('SMART_MONEY_MIN_VOLUME_USD', SMART_MONEY_RULES.minVolumeUsd),
    minScore: envNumber('SMART_MONEY_MIN_SCORE', SMART_MONEY_RULES.minScore),
  };
}

export function smartMoneyIntervalMs(env: Record<string, string | undefined> = process.env): number {
  return envNumber('SMART_MONEY_INTERVAL_MS', SMART_MONEY_DEFAULTS.intervalMs);
}

export function smartMoneyMaxPools(env: Record<string, string | undefined> = process.env): number {
  return Math.max(1, Math.min(100, Math.floor(envNumber('SMART_MONEY_MAX_POOLS', SMART_MONEY_DEFAULTS.maxPools))));
}

const errorCode = (error: unknown): string => {
  if (error instanceof MarketDataError) return error.kind.toUpperCase();
  return 'PROVIDER_ERROR';
};

/**
 * Select active tokens with fresh market evidence, then the deepest pools first. The evidence row
 * contains the exact DexScreener pair address; GeckoTerminal uses the same on-chain pool identifiers.
 */
async function candidateTokens(db: PrismaClient, maxPools: number, now: Date): Promise<CandidateToken[]> {
  const rows = await db.token.findMany({
    where: { blacklisted: false },
    select: {
      id: true, mint: true, symbol: true,
      metrics: { orderBy: { at: 'desc' }, take: 1, select: { liquidityUsd: true, at: true } },
    },
  });
  const active = rows
    .filter(row => {
      const metric = row.metrics[0];
      return metric && Number.isFinite(+metric.at) && +now - +metric.at <= 24 * 3_600_000;
    })
    .sort((a, b) => Number(b.metrics[0]!.liquidityUsd) - Number(a.metrics[0]!.liquidityUsd));
  if (!active.length) return [];

  const evidence = await db.systemSetting.findMany({
    where: { key: { in: active.map(row => `research.market.${row.id}`) } },
    select: { key: true, value: true },
  });
  const pairByToken = new Map<string, string>();
  for (const row of evidence) {
    const value = row.value as { pairAddress?: unknown } | null;
    if (typeof value?.pairAddress === 'string' && value.pairAddress.trim()) {
      pairByToken.set(row.key.slice('research.market.'.length), value.pairAddress.trim());
    }
  }

  const seenPools = new Set<string>();
  const out: CandidateToken[] = [];
  for (const row of active) {
    if (NEAR_REFERENCE_CONTRACTS.has(row.mint)) continue;
    const pairAddress = pairByToken.get(row.id);
    if (!pairAddress || seenPools.has(pairAddress)) continue;
    seenPools.add(pairAddress);
    out.push({
      id: row.id, mint: row.mint, symbol: row.symbol,
      liquidityUsd: Number(row.metrics[0]!.liquidityUsd), pairAddress,
    });
    if (out.length >= maxPools) break;
  }
  return out;
}

function normalizeTrade(raw: Awaited<ReturnType<PoolTradeSource['getRecentTrades']>>[number], tokenByMint: Map<string, CandidateToken>, now: Date): NormalizedTrade | null {
  if (raw.anomalous || !(raw.volumeUsd > 0)) return null;
  if (!isNearAccountId(raw.wallet) || raw.wallet === raw.poolAddress) return null;
  const atMs = raw.at.getTime();
  if (!Number.isFinite(atMs) || atMs > now.getTime() + 5 * 60_000) return null;
  if (now.getTime() - atMs > SMART_MONEY_DEFAULTS.maxTradeAgeHours * 3_600_000) return null;

  const from = raw.fromToken.toLowerCase(), to = raw.toToken.toLowerCase();
  const fromToken = tokenByMint.get(from), toToken = tokenByMint.get(to);
  if (fromToken && toToken) return null; // one pool with two tracked tokens: side is ambiguous
  const token = toToken ?? fromToken;
  if (!token) return null;
  const side = toToken ? 'BUY' : 'SELL';
  const tokenAmount = side === 'BUY' ? raw.toAmount : raw.fromAmount;
  const priceUsd = side === 'BUY' ? raw.toPriceUsd : raw.fromPriceUsd;
  if (!(tokenAmount > 0) || !Number.isFinite(raw.volumeUsd)) return null;

  return {
    wallet: raw.wallet,
    tokenId: token.id,
    source: 'geckoterminal',
    externalId: raw.id,
    poolAddress: raw.poolAddress,
    txHash: raw.txHash,
    side,
    tokenAmount,
    priceUsd: priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
    valueUsd: raw.volumeUsd,
    at: raw.at,
  };
}

async function storeTrades(db: PrismaClient, trades: NormalizedTrade[], now: Date): Promise<{ stored: number; addresses: string[] }> {
  const addresses = [...new Set(trades.map(trade => trade.wallet))];
  if (!addresses.length) return { stored: 0, addresses: [] };
  const bounds = new Map<string, { first: Date; last: Date }>();
  for (const trade of trades) {
    const current = bounds.get(trade.wallet);
    if (!current) bounds.set(trade.wallet, { first: trade.at, last: trade.at });
    else {
      if (trade.at < current.first) current.first = trade.at;
      if (trade.at > current.last) current.last = trade.at;
    }
  }

  let stored = 0;
  await db.$transaction(async tx => {
    await tx.smartWallet.createMany({
      data: addresses.map(address => {
        const b = bounds.get(address)!;
        return { address, firstSeenAt: b.first, lastTradeAt: b.last };
      }),
      skipDuplicates: true,
    });
    const wallets = await tx.smartWallet.findMany({ where: { address: { in: addresses } }, select: { id: true, address: true } });
    const idByAddress = new Map(wallets.map(wallet => [wallet.address, wallet.id]));
    const rows = trades.flatMap(trade => {
      const walletId = idByAddress.get(trade.wallet);
      if (!walletId) return [];
      return [{
        walletId, tokenId: trade.tokenId, source: trade.source, externalId: trade.externalId,
        poolAddress: trade.poolAddress, txHash: trade.txHash, side: trade.side,
        tokenAmount: trade.tokenAmount, priceUsd: trade.priceUsd, valueUsd: trade.valueUsd,
        at: trade.at, observedAt: now,
      }];
    });
    if (rows.length) {
      const result = await tx.smartWalletTrade.createMany({ data: rows, skipDuplicates: true });
      stored = result.count;
    }
  });
  return { stored, addresses };
}

async function recomputeProfiles(db: PrismaClient, addresses: string[], now: Date, rules: SmartMoneyRules): Promise<number> {
  if (!addresses.length) return 0;
  const wallets = await db.smartWallet.findMany({ where: { address: { in: addresses } }, select: { id: true, address: true } });
  let profiles = 0;
  for (const wallet of wallets) {
    const rows = await db.smartWalletTrade.findMany({
      where: { walletId: wallet.id },
      orderBy: [{ at: 'asc' }, { id: 'asc' }],
      select: { tokenId: true, side: true, tokenAmount: true, valueUsd: true, at: true },
    });
    const trades: SmartTradeRow[] = rows.map(row => ({
      token: row.tokenId,
      side: row.side,
      tokenAmount: Number(row.tokenAmount),
      valueUsd: Number(row.valueUsd),
      at: row.at,
    }));
    const stats = computeSmartWalletStats(trades);
    const score = smartWalletScore(stats);
    const assessment = assessSmartWallet(stats, score, rules);
    const observedFrom = stats.observedFrom ?? now, observedTo = stats.observedTo ?? now;
    await db.$transaction([
      db.smartWallet.update({ where: { id: wallet.id }, data: { firstSeenAt: observedFrom, lastTradeAt: observedTo } }),
      db.smartWalletProfile.upsert({
        where: { walletId: wallet.id },
        create: {
          walletId: wallet.id, updatedAt: now,
          tradeCount: stats.tradeCount, buyCount: stats.buyCount, sellCount: stats.sellCount,
          volumeUsd: stats.buyVolumeUsd + stats.sellVolumeUsd, totalBoughtUsd: stats.totalBoughtUsd,
          realizedPnlUsd: stats.pnlUsd, closedTrades: stats.legs.length, closedTokens: stats.closedTokens,
          winningTrades: stats.legs.filter(leg => leg.pnlUsd > 0).length,
          losingTrades: stats.legs.filter(leg => leg.pnlUsd < 0).length,
          winRate: stats.winRate, medianRoi: stats.medianRoi, profitFactor: stats.profitFactor,
          maxDrawdown: stats.maxDrawdown, score, status: assessment.status, eligible: assessment.eligible,
          reasons: assessment.reasons, unmatchedSells: stats.unmatchedSells, excessSellUnits: stats.excessSellUnits,
          observedFrom: stats.observedFrom, observedTo: stats.observedTo,
        },
        update: {
          updatedAt: now,
          tradeCount: stats.tradeCount, buyCount: stats.buyCount, sellCount: stats.sellCount,
          volumeUsd: stats.buyVolumeUsd + stats.sellVolumeUsd, totalBoughtUsd: stats.totalBoughtUsd,
          realizedPnlUsd: stats.pnlUsd, closedTrades: stats.legs.length, closedTokens: stats.closedTokens,
          winningTrades: stats.legs.filter(leg => leg.pnlUsd > 0).length,
          losingTrades: stats.legs.filter(leg => leg.pnlUsd < 0).length,
          winRate: stats.winRate, medianRoi: stats.medianRoi, profitFactor: stats.profitFactor,
          maxDrawdown: stats.maxDrawdown, score, status: assessment.status, eligible: assessment.eligible,
          reasons: assessment.reasons, unmatchedSells: stats.unmatchedSells, excessSellUnits: stats.excessSellUnits,
          observedFrom: stats.observedFrom, observedTo: stats.observedTo,
        },
      }),
    ]);
    profiles++;
  }
  return profiles;
}

/** Collect, persist and recompute. Errors are counted; a failed pool never becomes empty trade evidence. */
export async function refreshSmartMoney(db: PrismaClient, deps: SmartMoneyDeps): Promise<SmartMoneySummary> {
  const now = deps.now ?? new Date();
  const rules = deps.rules ?? SMART_MONEY_RULES;
  const candidates = await candidateTokens(db, deps.maxPools ?? SMART_MONEY_DEFAULTS.maxPools, now);
  const tokenByMint = new Map(candidates.map(token => [token.mint.toLowerCase(), token]));
  const errors: string[] = [];
  const affected = new Set<string>();
  const walletKinds = new Map<string, boolean | null>();
  let tradesSeen = 0, tradesStored = 0, contractsExcluded = 0, accountChecksFailed = 0;

  const allowedWallet = async (address: string): Promise<boolean> => {
    if (!deps.accountKind) return true;
    if (walletKinds.has(address)) return walletKinds.get(address) === false;
    let contract: boolean | null = null;
    try { contract = await deps.accountKind.isContract(address); }
    catch { contract = null; }
    walletKinds.set(address, contract);
    if (contract === true) contractsExcluded++;
    if (contract === null) accountChecksFailed++;
    return contract === false;
  };

  for (const token of candidates) {
    let rawTrades;
    try {
      rawTrades = await deps.trades.getRecentTrades(token.pairAddress);
    } catch (error) {
      errors.push(`${token.mint}:${errorCode(error)}`);
      continue;
    }
    tradesSeen += rawTrades.length;
    const normalized = new Map<string, NormalizedTrade>();
    for (const raw of rawTrades) {
      const trade = normalizeTrade(raw, tokenByMint, now);
      if (!trade || normalized.has(trade.externalId)) continue;
      if (!(await allowedWallet(trade.wallet))) continue;
      normalized.set(trade.externalId, trade);
    }
    if (!normalized.size) continue;
    const stored = await storeTrades(db, [...normalized.values()], now);
    tradesStored += stored.stored;
    for (const address of stored.addresses) affected.add(address);
  }

  if (accountChecksFailed) errors.push('ACCOUNT_CHECK_FAILED');
  const profiles = await recomputeProfiles(db, [...affected], now, rules);
  const summary: SmartMoneySummary = {
    pools: candidates.length, tradesSeen, tradesStored, walletsTouched: affected.size,
    profiles, contractsExcluded, accountChecksFailed, errors, source: deps.trades.name,
  };
  await db.systemSetting.upsert({
    where: { key: SMART_MONEY_HEALTH_KEY },
    create: { key: SMART_MONEY_HEALTH_KEY, value: { at: now.toISOString(), ...summary } },
    update: { value: { at: now.toISOString(), ...summary } },
  });
  return summary;
}
