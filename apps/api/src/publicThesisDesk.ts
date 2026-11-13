import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@narra/database';
import { isBridgedAsset, sanitizeUntrusted } from '@narra/shared';
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
  links: PublicThesisTokenLink[];
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
}

const num = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number((value as { toString(): string }).toString());
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (at: Date | null | undefined): string | null =>
  at && Number.isFinite(+at) ? at.toISOString() : null;

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
    const passesFloors = liquidityUsd != null && holders != null && liquidityUsd >= MIN_LIQUIDITY_USD && holders >= MIN_HOLDERS;

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
