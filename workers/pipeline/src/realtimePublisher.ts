import type { Redis } from 'ioredis';
import type { PrismaClient } from '@narra/database';
import { createEventStream, type NewEvent } from '@narra/realtime';
import { NEAR_PRICE_KEY } from './marketData';

/** Starting values, not tuned. */
export const PUBLISH_LIMITS = {
  /**
   * Rows are re-read from this far before the last published time. Workers stamp rows with the job's start time, so a row can
   * become visible after a newer one has already been published. Re-reading the window catches those late commits, and the
   * dedupe key stops the rows seen twice from being sent twice. Must be shorter than the dedupe TTL (15 minutes).
   */
  overlapMs: 2 * 60_000,
  /** After downtime, do not replay more than this much history into the stream. */
  maxCatchUpMs: 10 * 60_000,
  /**
   * A row dated further ahead than this is not published and never moves the watermark. Without the cap, one row with a bad
   * clock would push the watermark into the future and every later row would look old and be skipped.
   */
  maxFutureSkewMs: 5 * 60_000,
  page: 200,
  maxPagesPerSource: 10,
  /** Keys remembered in this process so overlapped rows do not each cost a Redis round trip. */
  localSeenMax: 20_000,
} as const;

export interface PublishSummary { published: number; duplicates: number; /** Rows dated too far in the future, left unpublished. */ skippedFuture: number; bySource: Record<string, number>; errors: string[] }

interface Row { id: string }
interface Source<R extends Row> {
  name: string;
  at(r: R): Date;
  /** Rows with (time, id) after `after`, at or after `since`, oldest first. */
  find(db: PrismaClient, since: Date, after: { at: Date; id: string } | null, take: number): Promise<R[]>;
  toEvent(r: R): NewEvent | null;
}

/** Builds the keyset filter shared by every source: time >= since, and strictly after the cursor when there is one. */
function window(field: string, since: Date, after: { at: Date; id: string } | null) {
  return after
    ? { AND: [{ [field]: { gte: since } }, { OR: [{ [field]: { gt: after.at } }, { [field]: after.at, id: { gt: after.id } }] }] }
    : { [field]: { gte: since } };
}
const order = (field: string) => [{ [field]: 'asc' as const }, { id: 'asc' as const }];

const SOURCES: Source<any>[] = [
  {
    name: 'narrativeMetric', at: (r) => r.at,
    find: (db, since, after, take) => db.narrativeMetric.findMany({ where: window('at', since, after), orderBy: order('at'), take, include: { narrative: { select: { id: true, slug: true, name: true, stage: true } } } }),
    toEvent: (r) => ({ type: 'narrative.updated', at: r.at, data: { id: r.narrative.id, slug: r.narrative.slug, name: r.narrative.name, stage: r.narrative.stage, score: r.score, velocity: r.velocity, acceleration: r.acceleration, organicScore: r.organicScore } }),
  },
  {
    name: 'opportunity', at: (r) => r.createdAt,
    find: (db, since, after, take) => db.opportunity.findMany({ where: window('createdAt', since, after), orderBy: order('createdAt'), take, include: { token: { select: { mint: true, symbol: true } }, narrative: { select: { slug: true } } } }),
    toEvent: (r) => ({ type: 'opportunity.created', at: r.createdAt, data: { id: r.id, mint: r.token.mint, symbol: r.token.symbol, narrativeSlug: r.narrative?.slug ?? null, score: r.score } }),
  },
  {
    // Global decisions only. A per-user decision (userId set) is that user's own business and is not broadcast.
    name: 'decision', at: (r) => r.createdAt,
    find: (db, since, after, take) => db.agentDecision.findMany({ where: { AND: [{ userId: null }, window('createdAt', since, after)] }, orderBy: order('createdAt'), take, include: { analysis: { select: { opportunityId: true } } } }),
    toEvent: (r) => ({ type: 'decision.created', at: r.createdAt, data: { id: r.id, opportunityId: r.analysis?.opportunityId ?? null, action: r.action, confidence: r.confidence } }),
  },
  {
    // Alerts with no owner. An owned alert reaches its owner through the notification below, never the shared channel.
    name: 'alert', at: (r) => r.createdAt,
    find: (db, since, after, take) => db.alert.findMany({ where: { AND: [{ userId: null }, window('createdAt', since, after)] }, orderBy: order('createdAt'), take }),
    toEvent: (r) => ({ type: 'alert.created', at: r.createdAt, data: { id: r.id, kind: r.kind, priority: r.priority, title: r.title, body: r.body, refType: r.refType, refId: r.refId } }),
  },
  {
    name: 'notification', at: (r) => r.createdAt,
    find: (db, since, after, take) => db.notification.findMany({ where: window('createdAt', since, after), orderBy: order('createdAt'), take, include: { alert: true } }),
    toEvent: (r) => ({ type: 'notification.created', userId: r.userId, at: r.createdAt, data: { id: r.id, alertId: r.alertId, kind: r.alert.kind, priority: r.alert.priority, title: r.alert.title, body: r.alert.body, refType: r.alert.refType, refId: r.alert.refId } }),
  },
];

const localSeen = new Map<string, number>();
function remember(key: string, nowMs: number): boolean {
  if (localSeen.has(key)) return false;
  localSeen.set(key, nowMs);
  if (localSeen.size > PUBLISH_LIMITS.localSeenMax) {
    const cutoff = nowMs - 20 * 60_000;
    for (const [k, t] of localSeen) if (t < cutoff) localSeen.delete(k);
    if (localSeen.size > PUBLISH_LIMITS.localSeenMax) localSeen.clear(); // still too big: Redis dedupe remains the real guard
  }
  return true;
}

/**
 * Tails the tables that matter to a live terminal and appends one event per new row to the Redis stream.
 * Writers stay unchanged, a restarted worker catches up from its watermark, and a publish failure can never fail
 * the job that wrote the row. Delivery is at-least-once; clients treat events as "something changed, refetch".
 */
export async function publishNewEvents(db: PrismaClient, redis: Redis, opts: { now?: Date; streamKey?: string } = {}): Promise<PublishSummary> {
  const now = opts.now ?? new Date();
  const stream = createEventStream(redis, opts.streamKey);
  const out: PublishSummary = { published: 0, duplicates: 0, skippedFuture: 0, bySource: {}, errors: [] };
  const P = PUBLISH_LIMITS;
  const horizon = now.getTime() + P.maxFutureSkewMs;

  const emit = async (dedupeKey: string, e: NewEvent, source: string) => {
    const k = `${stream.key}|${dedupeKey}`;
    if (!remember(k, now.getTime())) return;
    const id = await stream.publishOnce(dedupeKey, e);
    if (id) { out.published++; out.bySource[source] = (out.bySource[source] ?? 0) + 1; } else out.duplicates++;
  };

  for (const src of SOURCES) {
    try {
      const wmKey = `${stream.key}:wm:${src.name}`;
      const stored = Number(await redis.get(wmKey));
      // First run: start from now, so history is not replayed into the stream.
      const wm = Number.isFinite(stored) && stored > 0 ? Math.max(stored, now.getTime() - P.maxCatchUpMs) : now.getTime();
      const first = !(Number.isFinite(stored) && stored > 0);
      const since = new Date(first ? wm : wm - P.overlapMs);
      let after: { at: Date; id: string } | null = null;
      let newest = wm;
      for (let page = 0; page < P.maxPagesPerSource; page++) {
        const rows = await src.find(db, since, after, P.page);
        for (const r of rows) {
          const t = src.at(r).getTime();
          if (t > horizon) { out.skippedFuture++; continue; }
          const ev = src.toEvent(r);
          if (ev) await emit(`${src.name}:${r.id}`, ev, src.name);
          newest = Math.max(newest, t);
        }
        if (rows.length < P.page) break;
        const last = rows[rows.length - 1]!;
        after = { at: src.at(last), id: last.id };
      }
      await redis.set(wmKey, String(newest), 'EX', 24 * 3600);
    } catch (e) {
      out.errors.push(`${src.name}: ${(e as Error).message}`);
    }
  }

  // NEAR/USD lives in one settings row. A new reading has a new `at`, which is also its dedupe key.
  try {
    const row = await db.systemSetting.findUnique({ where: { key: NEAR_PRICE_KEY } });
    const v = row?.value as { priceUsd?: unknown; at?: unknown } | null | undefined;
    if (typeof v?.priceUsd === 'number' && Number.isFinite(v.priceUsd) && v.priceUsd > 0 && typeof v.at === 'string' && !Number.isNaN(Date.parse(v.at))) {
      const at = new Date(v.at);
      if (now.getTime() - at.getTime() <= P.maxCatchUpMs) await emit(`near:${v.at}`, { type: 'market.near', at, data: { priceUsd: v.priceUsd } }, 'near');
    }
  } catch (e) { out.errors.push(`near: ${(e as Error).message}`); }

  return out;
}
