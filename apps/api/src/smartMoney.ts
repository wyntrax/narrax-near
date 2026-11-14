import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import { isNearAccountId } from '@narra/shared';
import { makeAuthenticate, type AccountDeps } from './account';
import { buildPublicSmartMoneySummary } from './publicThesisDesk';
import { Limit } from './paging';

const number = (value: unknown): number | null => {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
};
const status = z.enum(['QUALIFIED', 'PROVISIONAL', 'INSUFFICIENT']);
const statusFilter = z.enum(['ALL', 'QUALIFIED', 'PROVISIONAL', 'INSUFFICIENT']).default('ALL');
const sort = z.enum(['pnl', 'score', 'recent']).default('pnl');
const window = z.enum(['1h', '6h', '24h']).default('24h');
const WINDOW_MS: Record<z.infer<typeof window>, number> = { '1h': 3_600_000, '6h': 6 * 3_600_000, '24h': 86_400_000 };
const FLOW_TRADE_LIMIT = 5000;

interface WalletRow {
  walletId: string;
  updatedAt: Date;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  volumeUsd: unknown;
  totalBoughtUsd: unknown;
  realizedPnlUsd: unknown;
  closedTrades: number;
  closedTokens: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  medianRoi: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null;
  score: number | null;
  status: 'QUALIFIED' | 'PROVISIONAL' | 'INSUFFICIENT';
  eligible: boolean;
  reasons: string[];
  unmatchedSells: number;
  excessSellUnits: number;
  observedFrom: Date | null;
  observedTo: Date | null;
  wallet: { address: string; firstSeenAt: Date; lastTradeAt: Date };
}

const walletResponse = (row: WalletRow) => ({
  address: row.wallet.address,
  firstSeenAt: row.wallet.firstSeenAt,
  lastTradeAt: row.wallet.lastTradeAt,
  observedFrom: row.observedFrom,
  observedTo: row.observedTo,
  updatedAt: row.updatedAt,
  tradeCount: row.tradeCount,
  buyCount: row.buyCount,
  sellCount: row.sellCount,
  volumeUsd: number(row.volumeUsd),
  totalBoughtUsd: number(row.totalBoughtUsd),
  realizedPnlUsd: number(row.realizedPnlUsd),
  closedTrades: row.closedTrades,
  closedTokens: row.closedTokens,
  winningTrades: row.winningTrades,
  losingTrades: row.losingTrades,
  winRate: row.winRate,
  medianRoi: row.medianRoi,
  profitFactor: row.profitFactor,
  maxDrawdown: row.maxDrawdown,
  score: row.score,
  status: row.status,
  eligible: row.eligible,
  reasons: row.reasons,
  unmatchedSells: row.unmatchedSells,
  excessSellUnits: row.excessSellUnits,
});

/** Read-only observed-wallet research. No route accepts an address that could be mistaken for a wallet to control. */
export function registerSmartMoneyRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier' | 'now'>): void {
  const db: PrismaClient = deps.db;
  const now = deps.now ?? (() => new Date());
  const opts = { preHandler: makeAuthenticate(deps), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };

  app.get('/v1/smart-money/wallets', opts, async (req, reply) => {
    const query = z.object({
      limit: Limit.default(25), q: z.string().trim().max(64).optional(), status: statusFilter, sort,
    }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const at = now();
    const where = {
      ...(query.data.status === 'ALL' ? {} : { status: query.data.status }),
      ...(query.data.q ? { wallet: { address: { startsWith: query.data.q } } } : {}),
    };
    const [rows, trackedWallets, eligibleWallets, observedTrades, lastTrade, volume] = await Promise.all([
      db.smartWalletProfile.findMany({ where, include: { wallet: true }, take: 500 }),
      db.smartWalletProfile.count(),
      db.smartWalletProfile.count({ where: { eligible: true } }),
      db.smartWalletTrade.count(),
      db.smartWalletTrade.findFirst({ orderBy: { at: 'desc' }, select: { at: true } }),
      db.smartWalletTrade.aggregate({ _sum: { valueUsd: true } }),
    ]);
    const sorted = [...rows].sort((a, b) => {
      if (query.data.sort === 'score') return (b.score ?? -1) - (a.score ?? -1) || Number(b.realizedPnlUsd) - Number(a.realizedPnlUsd) || a.wallet.address.localeCompare(b.wallet.address);
      if (query.data.sort === 'recent') return +b.wallet.lastTradeAt - +a.wallet.lastTradeAt || a.wallet.address.localeCompare(b.wallet.address);
      return Number(b.realizedPnlUsd) - Number(a.realizedPnlUsd) || (b.winRate ?? -1) - (a.winRate ?? -1) || a.wallet.address.localeCompare(b.wallet.address);
    });
    // The demo snapshot intentionally keeps individual wallet rows and transaction hashes out of the
    // database. When the raw tables are empty, fall back to the saved anonymized aggregate so the
    // authenticated page shows the same observed counts as the public thesis desk. Never invents rows.
    const rawEmpty = trackedWallets === 0 && observedTrades === 0;
    const aggregate = rawEmpty ? await buildPublicSmartMoneySummary(db) : null;
    const aggregateSummary = aggregate && aggregate.observedTrades > 0 ? aggregate : null;
    return {
      asOf: at.toISOString(),
      items: sorted.slice(0, query.data.limit).map(walletResponse),
      nextCursor: null,
      source: aggregateSummary ? 'AGGREGATE' : 'OBSERVED',
      aggregate: aggregateSummary,
      summary: {
        trackedWallets, eligibleWallets, observedTrades,
        volumeUsd: number(volume._sum.valueUsd),
        lastTradeAt: lastTrade?.at ?? null,
      },
    };
  });

  app.get('/v1/smart-money/flows', opts, async (req, reply) => {
    const query = z.object({ window, limit: Limit.default(25) }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const at = now();
    const since = new Date(+at - WINDOW_MS[query.data.window]);
    const rows = await db.smartWalletTrade.findMany({
      where: { at: { gte: since, lte: at } },
      orderBy: { at: 'desc' }, take: FLOW_TRADE_LIMIT + 1,
      select: {
        tokenId: true, side: true, valueUsd: true, at: true, walletId: true,
        token: { select: { mint: true, symbol: true, name: true } },
      },
    });
    const truncated = rows.length > FLOW_TRADE_LIMIT;
    const used = rows.slice(0, FLOW_TRADE_LIMIT);
    const flows = new Map<string, {
      mint: string; symbol: string; name: string; buys: number; sells: number;
      buyUsd: number; sellUsd: number; wallets: Set<string>; lastTradeAt: Date; tradeCount: number;
    }>();
    for (const row of used) {
      const current = flows.get(row.tokenId) ?? {
        mint: row.token.mint, symbol: row.token.symbol, name: row.token.name,
        buys: 0, sells: 0, buyUsd: 0, sellUsd: 0, wallets: new Set<string>(),
        lastTradeAt: row.at, tradeCount: 0,
      };
      current.tradeCount++;
      current.wallets.add(row.walletId);
      if (row.at > current.lastTradeAt) current.lastTradeAt = row.at;
      const value = number(row.valueUsd) ?? 0;
      if (row.side === 'BUY') { current.buys++; current.buyUsd += value; }
      else { current.sells++; current.sellUsd += value; }
      flows.set(row.tokenId, current);
    }
    const items = [...flows.values()].map(flow => ({
      mint: flow.mint, symbol: flow.symbol, name: flow.name,
      buys: flow.buys, sells: flow.sells, tradeCount: flow.tradeCount,
      buyVolumeUsd: flow.buyUsd, sellVolumeUsd: flow.sellUsd, netFlowUsd: flow.buyUsd - flow.sellUsd,
      walletCount: flow.wallets.size, lastTradeAt: flow.lastTradeAt,
    })).sort((a, b) => b.netFlowUsd - a.netFlowUsd || +b.lastTradeAt - +a.lastTradeAt)
      .slice(0, query.data.limit);
    return {
      asOf: at.toISOString(), window: query.data.window, items, nextCursor: null,
      coverage: {
        trades: used.length, wallets: new Set(used.map(row => row.walletId)).size,
        from: since.toISOString(), to: at.toISOString(), truncated,
        observedSince: (await db.smartWalletTrade.findFirst({ orderBy: { at: 'asc' }, select: { at: true } }))?.at ?? null,
      },
    };
  });

  app.get('/v1/smart-money/wallets/:address', opts, async (req, reply) => {
    const parsed = z.object({ address: z.string().min(2).max(64) }).safeParse(req.params);
    if (!parsed.success || !isNearAccountId(parsed.data.address)) return reply.code(404).send({ error: 'NOT_FOUND' });
    const wallet = await db.smartWallet.findUnique({
      where: { address: parsed.data.address },
      include: {
        profile: true,
        trades: {
          orderBy: { at: 'desc' }, take: 100,
          include: { token: { select: { mint: true, symbol: true, name: true } } },
        },
      },
    });
    if (!wallet?.profile) return reply.code(404).send({ error: 'NOT_FOUND' });
    const grouped = new Map<string, {
      mint: string; symbol: string; name: string; buyCount: number; sellCount: number;
      buyVolumeUsd: number; sellVolumeUsd: number; lastTradeAt: Date;
    }>();
    const all = await db.smartWalletTrade.findMany({
      where: { walletId: wallet.id }, orderBy: { at: 'desc' }, take: 1000,
      include: { token: { select: { mint: true, symbol: true, name: true } } },
    });
    for (const trade of all) {
      const current = grouped.get(trade.tokenId) ?? {
        mint: trade.token.mint, symbol: trade.token.symbol, name: trade.token.name,
        buyCount: 0, sellCount: 0, buyVolumeUsd: 0, sellVolumeUsd: 0, lastTradeAt: trade.at,
      };
      if (+trade.at > +current.lastTradeAt) current.lastTradeAt = trade.at;
      const value = number(trade.valueUsd) ?? 0;
      if (trade.side === 'BUY') { current.buyCount++; current.buyVolumeUsd += value; }
      else { current.sellCount++; current.sellVolumeUsd += value; }
      grouped.set(trade.tokenId, current);
    }
    return {
      address: wallet.address,
      firstSeenAt: wallet.firstSeenAt,
      lastTradeAt: wallet.lastTradeAt,
      profile: walletResponse({ ...wallet.profile, wallet: { address: wallet.address, firstSeenAt: wallet.firstSeenAt, lastTradeAt: wallet.lastTradeAt } }),
      tokenBreakdown: [...grouped.values()].map(item => ({
        ...item,
        netFlowUsd: item.buyVolumeUsd - item.sellVolumeUsd,
        tradeCount: item.buyCount + item.sellCount,
      })).sort((a, b) => b.buyVolumeUsd + b.sellVolumeUsd - (a.buyVolumeUsd + a.sellVolumeUsd)),
      trades: wallet.trades.map(trade => ({
        id: trade.id, at: trade.at, side: trade.side,
        token: trade.token, tokenAmount: number(trade.tokenAmount), priceUsd: number(trade.priceUsd),
        valueUsd: number(trade.valueUsd), poolAddress: trade.poolAddress, txHash: trade.txHash,
        source: trade.source,
      })),
      coverage: {
        tradesRead: wallet.trades.length,
        tokenRowsRead: all.length,
        tokenRowsCapped: all.length >= 1000,
      },
    };
  });

  app.get('/v1/smart-money/meta', opts, async () => ({
    source: 'geckoterminal',
    observedOnly: true,
    methodology: {
      costBasis: 'average-cost per token over observed buys and sells',
      realizedOnly: true,
      openPositionsMarked: false,
      unmatchedSellsExcluded: true,
      entityClustering: false,
      backfill: false,
    },
    statuses: status.options,
  }));
}
