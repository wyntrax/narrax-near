import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@narra/database';
import { NEAR_REFERENCE_CONTRACTS } from '@narra/market-data';
import { isBridgedAsset, isImplicitNearAccount, sanitizeUntrusted } from '@narra/shared';
import { MIN_HOLDERS, MIN_LIQUIDITY_USD } from '@narra/token-intel';
import { AGENT_RISK_POLICY } from './agentRisk';

export interface PublicThesisNarrative {
  slug: string;
  name: string;
  stage: string;
  score: number;
  velocity: number;
  firstDetectedAt: string;
  observedAt: string | null;
  fresh: boolean;
  organicScore: number | null;
  manipulationRisk: number | null;
  linkedTokenCount: number;
}

export interface PublicThesisTokenLink {
  slug: string;
  name: string;
  stage: string;
  relation: string;
  ogScore: number;
  matchScore: number;
  confidence: number;
}

export interface PublicThesisToken {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketAt: string | null;
  holders: number | null;
  top10Pct: number | null;
  holdersAt: string | null;
  riskScore: number | null;
  flags: string[];
  riskAt: string | null;
  passesFloors: boolean;
  marketFresh: boolean;
  holdersFresh: boolean;
  riskFresh: boolean;
  freshness: 'FRESH' | 'STALE' | 'MISSING';
  links: PublicThesisTokenLink[];
}

export const PUBLIC_SMART_MONEY_SUMMARY_KEY = 'research.smartMoney.publicSummary';

export interface PublicThesisSmartMoneyFlow {
  mint: string;
  symbol: string;
  name: string;
  netFlowUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  buys: number;
  sells: number;
  walletCount: number;
  lastTradeAt: string;
}

export interface PublicThesisSmartMoney {
  trackedWallets: number;
  qualifiedWallets: number;
  provisionalWallets: number;
  insufficientWallets: number;
  observedTrades: number;
  volumeUsd: number;
  observedFrom: string | null;
  lastTradeAt: string | null;
  flows: PublicThesisSmartMoneyFlow[];
}

export interface PublicThesisDesk {
  at: string;
  funnel: {
    activeNarratives: number;
    catalogTokens: number;
    bridgedExcluded: number;
    nativeTokens: number;
    narrativeLinkedTokens: number;
    holderCoveredTokens: number;
    floorPassingTokens: number;
    opportunities24h: number;
  };
  policy: {
    minLiquidityUsd: number;
    minHolders: number;
    maxRiskScore: number;
  };
  narratives: PublicThesisNarrative[];
  tokens: PublicThesisToken[];
  smartMoney: PublicThesisSmartMoney;
}

const num = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number((value as { toString(): string }).toString());
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (at: Date | null | undefined): string | null =>
  at && Number.isFinite(+at) ? at.toISOString() : null;

const freshAt = (at: Date | null | undefined, maxAgeMs: number, now: Date): boolean =>
  !!at && Number.isFinite(+at) && +at <= +now && +now - +at <= maxAgeMs;

/**
 * Loads public research evidence for the keyless `/thesis` desk: watched narratives,
 * the narrative-to-token conversion funnel, and native (non-bridged) NEAR tokens.
 * Exposes no user, private monitor, brief, or wallet-tracking data.
 */
export async function loadPublicThesisDesk(db: PrismaClient, at: Date): Promise<PublicThesisDesk> {
  const since = new Date(+at - 86_400_000);
  const [narrativeRows, tokenRows, opportunities24h] = await Promise.all([
    db.narrative.findMany({
      where: { stage: { not: 'DEAD' } },
      orderBy: [{ score: 'desc' }, { id: 'asc' }],
      take: 12,
      select: {
        slug: true,
        name: true,
        stage: true,
        score: true,
        velocity: true,
        firstDetectedAt: true,
        metrics: {
          where: { at: { lte: at } },
          orderBy: { at: 'desc' },
          take: 1,
          select: { at: true, organicScore: true, manipulationRisk: true },
        },
        tokens: {
          where: { token: { blacklisted: false } },
          select: { token: { select: { mint: true } } },
        },
      },
    }),
    db.token.findMany({
      where: { blacklisted: false },
      orderBy: [{ mint: 'asc' }],
      take: 120,
      select: {
        mint: true,
        symbol: true,
        name: true,
        metrics: {
          where: { at: { lte: at } },
          orderBy: { at: 'desc' },
          take: 1,
          select: { priceUsd: true, marketCapUsd: true, liquidityUsd: true, volume24hUsd: true, at: true },
        },
        holders: {
          where: { at: { lte: at } },
          orderBy: { at: 'desc' },
          take: 1,
          select: { holders: true, top10Pct: true, at: true },
        },
        risk: {
          where: { at: { lte: at } },
          orderBy: { at: 'desc' },
          take: 1,
          select: { riskScore: true, flags: true, at: true },
        },
        narratives: {
          where: { narrative: { stage: { not: 'DEAD' } } },
          orderBy: { matchScore: 'desc' },
          take: 3,
          select: {
            relation: true,
            ogScore: true,
            matchScore: true,
            confidence: true,
            narrative: { select: { slug: true, name: true, stage: true } },
          },
        },
      },
    }),
    db.opportunity.count({ where: { createdAt: { gte: since, lte: at } } }),
  ]);

  const narratives: PublicThesisNarrative[] = narrativeRows.map((row) => {
    const latest = row.metrics[0];
    const linkedNative = row.tokens.filter((item) => !isBridgedAsset(item.token.mint)).length;
    return {
      slug: row.slug,
      name: sanitizeUntrusted(row.name, 80),
      stage: row.stage,
      score: row.score,
      velocity: row.velocity,
      firstDetectedAt: row.firstDetectedAt.toISOString(),
      observedAt: iso(latest?.at),
      fresh: freshAt(latest?.at, AGENT_RISK_POLICY.evidenceMaxAgeMs, at),
      organicScore: latest?.organicScore ?? null,
      manipulationRisk: latest?.manipulationRisk ?? null,
      linkedTokenCount: linkedNative,
    };
  });

  const nativeRows = tokenRows.filter((row) => !isBridgedAsset(row.mint));
  const bridgedExcluded = tokenRows.length - nativeRows.length;

  const tokens: PublicThesisToken[] = nativeRows.map((row) => {
    const m = row.metrics[0];
    const h = row.holders[0];
    const r = row.risk[0];
    const liquidityUsd = num(m?.liquidityUsd);
    const holders = h?.holders ?? null;
    const marketFresh = freshAt(m?.at, AGENT_RISK_POLICY.metricMaxAgeMs, at);
    const holdersFresh = freshAt(h?.at, AGENT_RISK_POLICY.evidenceMaxAgeMs, at);
    const riskFresh = freshAt(r?.at, AGENT_RISK_POLICY.evidenceMaxAgeMs, at);
    const passesFloors = marketFresh && holdersFresh
      && liquidityUsd != null && liquidityUsd >= MIN_LIQUIDITY_USD
      && holders != null && holders >= MIN_HOLDERS;
    const freshness = !m && !h && !r
      ? 'MISSING'
      : marketFresh && holdersFresh && riskFresh ? 'FRESH' : 'STALE';

    return {
      mint: row.mint,
      symbol: sanitizeUntrusted(row.symbol, 24),
      name: sanitizeUntrusted(row.name, 80),
      priceUsd: num(m?.priceUsd),
      marketCapUsd: num(m?.marketCapUsd),
      liquidityUsd,
      volume24hUsd: num(m?.volume24hUsd),
      marketAt: iso(m?.at),
      holders,
      top10Pct: h?.top10Pct ?? null,
      holdersAt: iso(h?.at),
      riskScore: r?.riskScore ?? null,
      flags: r?.flags ?? [],
      riskAt: iso(r?.at),
      passesFloors,
      marketFresh,
      holdersFresh,
      riskFresh,
      freshness,
      links: row.narratives.map((rel) => ({
        slug: rel.narrative.slug,
        name: sanitizeUntrusted(rel.narrative.name, 80),
        stage: rel.narrative.stage,
        relation: rel.relation,
        ogScore: rel.ogScore,
        matchScore: rel.matchScore,
        confidence: rel.confidence,
      })),
    };
  });

  tokens.sort((a, b) => {
    if (a.passesFloors !== b.passesFloors) return a.passesFloors ? -1 : 1;
    const liqDiff = (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1);
    if (liqDiff !== 0) return liqDiff;
    return a.mint.localeCompare(b.mint);
  });

  const smartMoney = await buildPublicSmartMoneySummary(db);

  return {
    at: at.toISOString(),
    funnel: {
      activeNarratives: narratives.length,
      catalogTokens: tokenRows.length,
      bridgedExcluded,
      nativeTokens: tokens.length,
      narrativeLinkedTokens: tokens.filter((t) => t.links.length > 0).length,
      holderCoveredTokens: tokens.filter((t) => t.holders != null).length,
      floorPassingTokens: tokens.filter((t) => t.passesFloors).length,
      opportunities24h,
    },
    policy: {
      minLiquidityUsd: MIN_LIQUIDITY_USD,
      minHolders: MIN_HOLDERS,
      maxRiskScore: AGENT_RISK_POLICY.maxRiskScore,
    },
    narratives,
    tokens,
    smartMoney,
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseSavedSmartMoney(raw: unknown): PublicThesisSmartMoney | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.trackedWallets !== 'number' || typeof v.observedTrades !== 'number' || !Array.isArray(v.flows)) {
    return null;
  }
  return {
    trackedWallets: v.trackedWallets,
    qualifiedWallets: typeof v.qualifiedWallets === 'number' ? v.qualifiedWallets : 0,
    provisionalWallets: typeof v.provisionalWallets === 'number' ? v.provisionalWallets : 0,
    insufficientWallets: typeof v.insufficientWallets === 'number' ? v.insufficientWallets : 0,
    observedTrades: v.observedTrades,
    volumeUsd: typeof v.volumeUsd === 'number' ? roundUsd(v.volumeUsd) : 0,
    observedFrom: typeof v.observedFrom === 'string' ? v.observedFrom : null,
    lastTradeAt: typeof v.lastTradeAt === 'string' ? v.lastTradeAt : null,
    flows: v.flows
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        mint: String(item.mint ?? ''),
        symbol: sanitizeUntrusted(String(item.symbol ?? ''), 24),
        name: sanitizeUntrusted(String(item.name ?? ''), 80),
        netFlowUsd: roundUsd(Number(item.netFlowUsd) || 0),
        buyVolumeUsd: roundUsd(Number(item.buyVolumeUsd) || 0),
        sellVolumeUsd: roundUsd(Number(item.sellVolumeUsd) || 0),
        buys: Number(item.buys) || 0,
        sells: Number(item.sells) || 0,
        walletCount: Number(item.walletCount) || 0,
        lastTradeAt: String(item.lastTradeAt ?? ''),
      }))
      .filter((item) => Boolean(item.mint && item.lastTradeAt)),
  };
}

/**
 * Builds an anonymized aggregate smart-money summary (wallet status counts, total trades/volume,
 * and per-token net flows) without exposing individual wallet addresses or transaction hashes.
 */
export async function buildPublicSmartMoneySummary(db: PrismaClient): Promise<PublicThesisSmartMoney> {
  const profiles =
    typeof db.smartWalletProfile?.findMany === 'function'
      ? await db.smartWalletProfile.findMany({ select: { status: true } })
      : [];
  const trades =
    typeof db.smartWalletTrade?.findMany === 'function'
      ? await db.smartWalletTrade.findMany({
          orderBy: { at: 'desc' },
          take: 5_000,
          select: {
            tokenId: true,
            walletId: true,
            side: true,
            valueUsd: true,
            at: true,
            token: { select: { mint: true, symbol: true, name: true } },
          },
        })
      : [];

  if (profiles.length === 0 && trades.length === 0) {
    if (typeof db.systemSetting?.findUnique === 'function') {
      const saved = await db.systemSetting.findUnique({ where: { key: PUBLIC_SMART_MONEY_SUMMARY_KEY } });
      const parsed = parseSavedSmartMoney(saved?.value);
      if (parsed) return parsed;
    }
    return {
      trackedWallets: 0,
      qualifiedWallets: 0,
      provisionalWallets: 0,
      insufficientWallets: 0,
      observedTrades: 0,
      volumeUsd: 0,
      observedFrom: null,
      lastTradeAt: null,
      flows: [],
    };
  }

  let qualifiedWallets = 0;
  let provisionalWallets = 0;
  let insufficientWallets = 0;
  for (const p of profiles) {
    if (p.status === 'QUALIFIED') qualifiedWallets++;
    else if (p.status === 'PROVISIONAL') provisionalWallets++;
    else insufficientWallets++;
  }

  let volumeUsd = 0;
  let earliest: Date | null = null;
  let latest: Date | null = null;
  const allWallets = new Set<string>();
  const flowMap = new Map<
    string,
    {
      mint: string;
      symbol: string;
      name: string;
      buyUsd: number;
      sellUsd: number;
      buys: number;
      sells: number;
      wallets: Set<string>;
      lastTradeAt: Date;
    }
  >();

  for (const row of trades) {
    const val = num(row.valueUsd) ?? 0;
    volumeUsd += val;
    allWallets.add(row.walletId);
    if (!earliest || row.at < earliest) earliest = row.at;
    if (!latest || row.at > latest) latest = row.at;

    const mint = row.token.mint;
    if (NEAR_REFERENCE_CONTRACTS.has(mint) || isBridgedAsset(mint) || isImplicitNearAccount(mint)) {
      continue;
    }
    const cur = flowMap.get(row.tokenId) ?? {
      mint,
      symbol: sanitizeUntrusted(row.token.symbol, 24),
      name: sanitizeUntrusted(row.token.name, 80),
      buyUsd: 0,
      sellUsd: 0,
      buys: 0,
      sells: 0,
      wallets: new Set<string>(),
      lastTradeAt: row.at,
    };
    cur.wallets.add(row.walletId);
    if (row.at > cur.lastTradeAt) cur.lastTradeAt = row.at;
    if (row.side === 'BUY') {
      cur.buys++;
      cur.buyUsd += val;
    } else {
      cur.sells++;
      cur.sellUsd += val;
    }
    flowMap.set(row.tokenId, cur);
  }

  const flows: PublicThesisSmartMoneyFlow[] = [...flowMap.values()]
    .map((f) => ({
      mint: f.mint,
      symbol: f.symbol,
      name: f.name,
      netFlowUsd: roundUsd(f.buyUsd - f.sellUsd),
      buyVolumeUsd: roundUsd(f.buyUsd),
      sellVolumeUsd: roundUsd(f.sellUsd),
      buys: f.buys,
      sells: f.sells,
      walletCount: f.wallets.size,
      lastTradeAt: f.lastTradeAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        Math.abs(b.netFlowUsd) - Math.abs(a.netFlowUsd) ||
        b.buyVolumeUsd + b.sellVolumeUsd - (a.buyVolumeUsd + a.sellVolumeUsd),
    )
    .slice(0, 12);

  return {
    trackedWallets: profiles.length || allWallets.size,
    qualifiedWallets,
    provisionalWallets,
    insufficientWallets: profiles.length ? insufficientWallets : allWallets.size,
    observedTrades: trades.length,
    volumeUsd: roundUsd(volumeUsd),
    observedFrom: earliest ? earliest.toISOString() : null,
    lastTradeAt: latest ? latest.toISOString() : null,
    flows,
  };
}

/** Cached (30s) and rate-limited public endpoint powering the `/thesis` research desk. */
export function registerPublicThesisDesk(app: FastifyInstance, db: PrismaClient, clock: () => Date = () => new Date()): void {
  let cached: Promise<PublicThesisDesk> | undefined;
  let expires = 0;

  app.get('/v1/public-thesis-desk', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (_req, reply) => {
    if (!cached || +clock() >= expires) {
      expires = +clock() + 30_000;
      const pending = loadPublicThesisDesk(db, clock());
      cached = pending;
      void pending.catch(() => { if (cached === pending) { cached = undefined; expires = 0; } });
    }
    const value = await cached;
    reply.header('cache-control', 'public, max-age=30');
    return value;
  });
}
