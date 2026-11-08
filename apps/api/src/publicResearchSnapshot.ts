import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@narra/database';

/** Public aggregate counts only. No narrative rows, token identities or private research. */
export interface PublicResearchSnapshot {
  at: string;
  narrativeHeat: number | null;
  narrativeSampleSize: number;
  narrativeAsOf: string | null;
  activeNarratives: number;
  tokensObserved: number;
  opportunities24h: number;
  earlyRadar24h: number;
}

export async function loadPublicResearchSnapshot(db: PrismaClient, at: Date): Promise<PublicResearchSnapshot> {
  const since = new Date(+at - 86_400_000);
  const [top, activeNarratives, tokensObserved, opportunities24h, earlyRadar24h] = await Promise.all([
    db.narrative.findMany({
      where: { stage: { not: 'DEAD' } },
      orderBy: [{ score: 'desc' }, { id: 'asc' }],
      take: 5,
      select: { score: true, metrics: { where: { at: { lte: at } }, orderBy: { at: 'desc' }, take: 1, select: { at: true } } },
    }),
    db.narrative.count({ where: { stage: { not: 'DEAD' } } }),
    db.token.count({ where: { blacklisted: false } }),
    db.opportunity.count({ where: { createdAt: { gte: since, lte: at } } }),
    db.alert.count({ where: { kind: { startsWith: 'EARLY_RADAR' }, createdAt: { gte: since, lte: at } } }),
  ]);
  const stamps = top.map((row) => row.metrics[0]?.at);
  const allStampsKnown = stamps.length > 0 && stamps.every((value): value is Date => value instanceof Date && +value <= +at);
  return {
    at: at.toISOString(),
    narrativeHeat: top.length ? Math.round(top.reduce((sum, row) => sum + row.score, 0) / top.length) : null,
    narrativeSampleSize: top.length,
    narrativeAsOf: allStampsKnown ? new Date(Math.min(...stamps.map((value) => +value))).toISOString() : null,
    activeNarratives,
    tokensObserved,
    opportunities24h,
    earlyRadar24h,
  };
}

/** A cached, rate-limited public snapshot for the landing page. The cache is per process and expires after 30s. */
export function registerPublicResearchSnapshot(app: FastifyInstance, db: PrismaClient, clock: () => Date = () => new Date()): void {
  let cached: Promise<PublicResearchSnapshot> | undefined;
  let expires = 0;
  app.get('/v1/public-research-snapshot', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (_req, reply) => {
    if (!cached || +clock() >= expires) {
      expires = +clock() + 30_000;
      const pending = loadPublicResearchSnapshot(db, clock());
      cached = pending;
      void pending.catch(() => { if (cached === pending) { cached = undefined; expires = 0; } });
    }
    const value = await cached;
    reply.header('cache-control', 'public, max-age=30');
    return value;
  });
}
