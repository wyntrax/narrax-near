import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import { detectRotation, ROTATION_RULES, type RotationResult } from '@narra/narrative';
import { sanitizeUntrusted } from '@narra/shared';
import { NEAR_PRICE_KEY } from '@narra/worker-pipeline';
import { makeAuthenticate, type AccountDeps } from './account';
import { canReadFeature } from './entitlements/access';

const HOUR = 3_600_000;
/** A NEAR price older than this is returned with stale: true, so the UI never shows an old number as current. */
const NEAR_STALE_MS = 15 * 60_000;
const WINDOWS = { '1h': HOUR, '6h': 6 * HOUR, '24h': 24 * HOUR, '7d': 168 * HOUR } as const;
type WindowKey = keyof typeof WINDOWS;
const n = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));

export async function loadNearUsd(db: PrismaClient, now: Date) {
  const row = await db.systemSetting.findUnique({ where: { key: NEAR_PRICE_KEY } });
  const v = row?.value as { priceUsd?: unknown; at?: unknown } | null | undefined;
  if (typeof v?.priceUsd !== 'number' || !Number.isFinite(v.priceUsd) || v.priceUsd <= 0 || typeof v.at !== 'string') return null;
  const at = new Date(v.at);
  if (Number.isNaN(at.getTime())) return null;
  return { priceUsd: v.priceUsd, at, stale: now.getTime() - at.getTime() > NEAR_STALE_MS };
}

/**
 * Score now against the score at the start of the window, for the top narratives. A narrative with no reading near the
 * start of the window, or none inside the window now, is reported as unknown, never as unchanged.
 */
export async function loadRotation(db: PrismaClient, windowKey: WindowKey, now: Date): Promise<RotationResult & { window: WindowKey; asOf: Date }> {
  const span = WINDOWS[windowKey];
  const since = new Date(now.getTime() - span);
  const before = new Date(since.getTime() - span);
  const rows = await db.$queryRaw<{ id: string; slug: string; name: string; stage: string; cur: number | null; curAt: Date | null; prev: number | null }[]>`
    SELECT n."id", n."slug", n."name", n."stage"::text AS "stage",
      (SELECT m."score" FROM "NarrativeMetric" m WHERE m."narrativeId" = n."id" AND m."at" <= ${now} ORDER BY m."at" DESC LIMIT 1) AS "cur",
      (SELECT m."at" FROM "NarrativeMetric" m WHERE m."narrativeId" = n."id" AND m."at" <= ${now} ORDER BY m."at" DESC LIMIT 1) AS "curAt",
      (SELECT m."score" FROM "NarrativeMetric" m WHERE m."narrativeId" = n."id" AND m."at" <= ${since} AND m."at" >= ${before} ORDER BY m."at" DESC LIMIT 1) AS "prev"
    FROM "Narrative" n WHERE n."stage" <> 'DEAD' ORDER BY n."score" DESC, n."id" LIMIT 200`;
  const result = detectRotation(rows.map((x) => ({
    id: x.id, slug: x.slug, name: sanitizeUntrusted(x.name, 80), stage: x.stage,
    currentScore: x.curAt && x.curAt >= since ? x.cur : null, previousScore: x.prev,
  })));
  return { ...result, window: windowKey, asOf: now };
}

async function loadBar(db: PrismaClient, now: Date) {
  const since = new Date(now.getTime() - 24 * HOUR);
  const [near, top, activeNarratives, accelerating, opportunities24h] = await Promise.all([
    loadNearUsd(db, now),
    db.narrative.findMany({ where: { stage: { not: 'DEAD' } }, orderBy: [{ score: 'desc' }, { id: 'asc' }], take: 5, select: { id: true, slug: true, name: true, stage: true, score: true, velocity: true } }),
    db.narrative.count({ where: { stage: { not: 'DEAD' } } }),
    db.narrative.count({ where: { stage: 'ACCELERATING' } }),
    db.opportunity.count({ where: { createdAt: { gte: since } } }),
  ]);
  return {
    top,
    bar: {
      nearUsd: near ? { priceUsd: near.priceUsd, at: near.at, stale: near.stale } : null,
      // Mean score of the five strongest live narratives. A summary of the list below it, not a separate signal. Null when there are none.
      narrativeHeat: top.length ? Math.round(top.reduce((s, x) => s + x.score, 0) / top.length) : null,
      counts: { activeNarratives, acceleratingNarratives: accelerating, opportunities24h },
    },
  };
}

/** Facts in plain sentences, built by fixed rules from the numbers. No model is involved, so nothing here can be hallucinated or injected. */
function composeBrief(top: { name: string; stage: string; score: number }[], bar: { nearUsd: { stale: boolean } | null; counts: { acceleratingNarratives: number } }, rotation: (RotationResult & { window: string }) | null): string[] {
  const out: string[] = [];
  const lead = top[0];
  if (lead) out.push(`${sanitizeUntrusted(lead.name, 60)} leads the narratives at a score of ${Math.round(lead.score)} (${lead.stage.toLowerCase()}).`);
  else out.push('No live narratives yet.');
  if (bar.counts.acceleratingNarratives > 0) out.push(`${bar.counts.acceleratingNarratives} narrative${bar.counts.acceleratingNarratives === 1 ? ' is' : 's are'} accelerating.`);
  if (rotation?.detected) {
    const from = rotation.falling[0]!, to = rotation.rising[0]!;
    out.push(`Attention is moving from ${from.name} (${Math.round(from.from)} to ${Math.round(from.to)}) to ${to.name} (${Math.round(to.from)} to ${Math.round(to.to)}) over ${rotation.window}.`);
  }
  if (!bar.nearUsd) out.push('The NEAR price is not available right now.');
  else if (bar.nearUsd.stale) out.push('The NEAR price is stale.');
  return out;
}

/** Dashboard data. Market data is shared. The `me` block is the signed-in user's own counts. */
export function registerOverviewRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier' | 'now'>): void {
  const db: PrismaClient = deps.db;
  const now = deps.now ?? (() => new Date());
  const opts = { preHandler: makeAuthenticate(deps), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };

  // Deliberately tier-independent, authenticated teaser. Never include identities or detailed research.
  app.get('/v1/market-preview', opts, async () => {
    const at = now();
    const [nearUsd, top, opportunities24h] = await Promise.all([
      loadNearUsd(db, at),
      db.narrative.findMany({ where: { stage: { not: 'DEAD' } }, orderBy: [{ score: 'desc' }, { id: 'asc' }], take: 5, select: { score: true } }),
      db.opportunity.count({ where: { createdAt: { gte: new Date(+at - 24 * HOUR), lte: at } } }),
    ]);
    return { at, nearUsd, narrativeHeat: top.length ? Math.round(top.reduce((sum, row) => sum + row.score, 0) / top.length) : null, opportunities24h };
  });

  // Light enough to poll. The global intelligence bar.
  app.get('/v1/intelligence-bar', opts, async () => {
    const at = now();
    const { bar } = await loadBar(db, at);
    return { ...bar, at };
  });

  app.get('/v1/overview', opts, async (req) => {
    const at = now(); const userId = req.userId!;
    const [overviewAccess, narrativeAccess, rotationAccess, opportunityAccess] = await Promise.all((['research.overview', 'research.narratives', 'research.rotation', 'research.opportunities'] as const).map(key => canReadFeature(db, userId, key, at, entry => req.log.info(entry, 'research access decision'))));
    const [summary, rotation, hottest, unreadAlerts] = await Promise.all([
      overviewAccess ? loadBar(db, at) : null,
      rotationAccess ? loadRotation(db, '24h', at) : null,
      opportunityAccess ? db.opportunity.findFirst({
        where: { createdAt: { gte: new Date(at.getTime() - 24 * HOUR) } }, orderBy: [{ score: 'desc' }, { id: 'asc' }],
        include: { token: { select: { mint: true, symbol: true, metrics: { orderBy: { at: 'desc' }, take: 1 } } }, narrative: { select: { name: true, slug: true } } },
      }) : null,
      db.notification.count({ where: { userId, readAt: null } }),
    ]);
    const m = hottest?.token.metrics[0];
    const bar = summary?.bar ?? null, top = narrativeAccess ? summary?.top ?? [] : [];
    return {
      at, bar,
      locked: { overview: !overviewAccess, narratives: !narrativeAccess, rotation: !rotationAccess, opportunities: !opportunityAccess },
      strip: {
        topNarratives: top.map((t) => ({ id: t.id, slug: t.slug, name: t.name, stage: t.stage, score: t.score, velocity: t.velocity })),
        hottestOpportunity: hottest ? { id: hottest.id, createdAt: hottest.createdAt, score: hottest.score, token: { mint: hottest.token.mint, symbol: hottest.token.symbol, priceUsd: n(m?.priceUsd), marketCapUsd: n(m?.marketCapUsd) }, narrative: hottest.narrative } : null,
      },
      rotation: rotation ? { detected: rotation.detected, window: rotation.window, falling: rotation.falling, rising: rotation.rising, unknown: rotation.unknown } : null,
      brief: { generated: 'rules', points: bar ? composeBrief(top, bar, rotation) : [] },
      me: { unreadAlerts },
    };
  });

  app.get('/v1/narratives/rotation', opts, async (req, reply) => {
    const q = z.object({ window: z.enum(['1h', '6h', '24h', '7d']).default('24h') }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const r = await loadRotation(db, q.data.window, now());
    // Rules are returned with the result: they are unvalidated starting values and the client should be able to say so.
    return { ...r, rules: { minDeltaPoints: ROTATION_RULES.minDeltaPoints, minScoreEitherEnd: ROTATION_RULES.minScoreEitherEnd }, note: 'A description of score changes over the window, not a prediction.' };
  });
}
