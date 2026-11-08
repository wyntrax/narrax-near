import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
export { PERSONAL_RESEARCH_QUEUE, PersonalResearchJobSchema, createPersonalResearchQueue } from './personalResearch';

export interface QueueCounts { waiting: number; active: number; failed: number; delayed: number; /** Workers connected to this queue right now. 0 with jobs waiting means nothing is consuming it. */ consumers?: number }
export interface QueueHealth { lastCompletedAt: string | null; lastFailedAt: string | null; lastRun: { analyzed?: number; providerFailures?: number; tokensUsed?: number; skipped?: string; rateLimited?: boolean } | null }

export const QUEUE_NAMES = {
  narrativeIngestion: 'narrative-ingestion',
  tokenResolution: 'token-resolution',
  aiAnalysis: 'ai-analysis',
  marketData: 'market-data',
  outcomeTracking: 'outcome-tracking',
  notificationDispatch: 'notification-dispatch',
  realtimePublish: 'realtime-publish',
  telegramDelivery: 'telegram-delivery',
  smartMoney: 'smart-money',
} as const;

/** BullMQ workers need maxRetriesPerRequest: null. */
export function createRedis(url = process.env.REDIS_URL ?? 'redis://localhost:6379'): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}

const RETAIN: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = {
  removeOnComplete: { age: 3600, count: 5000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/** For jobs that run every few seconds: keep little history so the queue does not fill Redis. */
const RETAIN_SHORT: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = {
  removeOnComplete: { age: 300, count: 100 },
  removeOnFail: { age: 24 * 3600, count: 500 },
};

const ALL_QUEUES = ['narrativeIngestion', 'tokenResolution', 'aiAnalysis', 'marketData', 'outcomeTracking', 'notificationDispatch', 'realtimePublish', 'telegramDelivery', 'smartMoney'] as const;

export function createQueues(connection: Redis) {
  const narrativeIngestion = new Queue(QUEUE_NAMES.narrativeIngestion, { connection });
  const tokenResolution = new Queue(QUEUE_NAMES.tokenResolution, { connection });
  const aiAnalysis = new Queue(QUEUE_NAMES.aiAnalysis, { connection });
  const marketData = new Queue(QUEUE_NAMES.marketData, { connection });
  const outcomeTracking = new Queue(QUEUE_NAMES.outcomeTracking, { connection });
  const notificationDispatch = new Queue(QUEUE_NAMES.notificationDispatch, { connection });
  const realtimePublish = new Queue(QUEUE_NAMES.realtimePublish, { connection });
  const telegramDelivery = new Queue(QUEUE_NAMES.telegramDelivery, { connection });
  const smartMoney = new Queue(QUEUE_NAMES.smartMoney, { connection });

  const queues = { narrativeIngestion, tokenResolution, aiAnalysis, marketData, outcomeTracking, notificationDispatch, realtimePublish, telegramDelivery, smartMoney };

  return {
    ...queues,
    scheduleOutcomeTracking: (everyMs = 15 * 60_000) =>
      outcomeTracking.upsertJobScheduler('track', { every: everyMs }, { name: 'track', data: {}, opts: { attempts: 1, ...RETAIN } }),
    /** Posts eligible global research alerts to the configured Telegram chat. */
    scheduleTelegramDelivery: (everyMs = 30_000) =>
      telegramDelivery.upsertJobScheduler('deliver', { every: everyMs }, { name: 'deliver', data: {}, opts: { attempts: 1, ...RETAIN_SHORT } }),
    /** Turns new alerts into per-user notifications. */
    scheduleNotificationDispatch: (everyMs = 5_000) =>
      notificationDispatch.upsertJobScheduler('dispatch', { every: everyMs }, { name: 'dispatch', data: {}, opts: { attempts: 1, ...RETAIN_SHORT } }),
    /** Appends new rows to the realtime event stream. */
    scheduleRealtimePublish: (everyMs = 2_000) =>
      realtimePublish.upsertJobScheduler('publish', { every: everyMs }, { name: 'publish', data: {}, opts: { attempts: 1, ...RETAIN_SHORT } }),
    scheduleMarketData: (everyMs = 5 * 60_000) =>
      marketData.upsertJobScheduler('refresh', { every: everyMs }, { name: 'refresh', data: {}, opts: { attempts: 1, ...RETAIN } }),
    /** Recent public NEAR pool trades; the worker does its own deduplication and profile recompute. */
    scheduleSmartMoney: (everyMs = 10 * 60_000) =>
      smartMoney.upsertJobScheduler('observe', { every: everyMs }, { name: 'observe', data: {}, opts: { attempts: 1, ...RETAIN } }),
    scheduleAiAnalysis: (everyMs = 5 * 60_000) =>
      aiAnalysis.upsertJobScheduler('analyze', { every: everyMs }, { name: 'analyze', data: {}, opts: { attempts: 1, ...RETAIN } }),
    scheduleTokenResolution: (everyMs = 10 * 60_000) =>
      tokenResolution.upsertJobScheduler('resolve', { every: everyMs }, { name: 'resolve', data: {}, opts: { attempts: 1, ...RETAIN } }),
    scheduleNarrativeIngestion: (everyMs = 5 * 60_000) =>
      narrativeIngestion.upsertJobScheduler('ingest', { every: everyMs }, { name: 'ingest', data: {}, opts: { attempts: 1, ...RETAIN } }),
    /** Waiting, active, failed and delayed job counts for every queue, for the admin status view. */
    counts: async (): Promise<Record<string, QueueCounts>> => {
      const out: Record<string, QueueCounts> = {};
      for (const q of ALL_QUEUES.map((name) => queues[name])) {
        const c = await q.getJobCounts('waiting', 'active', 'failed', 'delayed');
        let consumers: number | undefined;
        try { consumers = (await q.getWorkers()).length; } catch { consumers = undefined; }
        out[q.name] = { waiting: c.waiting ?? 0, active: c.active ?? 0, failed: c.failed ?? 0, delayed: c.delayed ?? 0, ...(consumers === undefined ? {} : { consumers }) };
      }
      return out;
    },
    health: async (): Promise<Record<string, QueueHealth>> => {
      const out: Record<string, QueueHealth> = {};
      await Promise.all([narrativeIngestion, tokenResolution, marketData, aiAnalysis].map(async (q) => {
        const [completed, failed] = await Promise.all([q.getJobs(['completed'], 0, 0), q.getJobs(['failed'], 0, 0)]);
        const job = completed[0]; let value: unknown = job?.returnvalue;
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
        const object = value && typeof value === 'object' ? value as Record<string, unknown> : null;
        const run: NonNullable<QueueHealth['lastRun']> = {};
        for (const key of ['analyzed', 'providerFailures', 'tokensUsed'] as const) if (typeof object?.[key] === 'number' && Number.isInteger(object[key]) && object[key] >= 0) run[key] = object[key];
        if (typeof object?.skipped === 'string' && ['disabled', 'budget', 'no_provider'].includes(object.skipped)) run.skipped = object.skipped;
        const summary = object?.summary && typeof object.summary === 'object' ? object.summary as Record<string, unknown> : object;
        if (Array.isArray(summary?.errors)) run.rateLimited = summary.errors.some(e => typeof e === 'string' && /rate_limited|HTTP 429/.test(e));
        out[q.name] = { lastCompletedAt: job?.finishedOn ? new Date(job.finishedOn).toISOString() : null, lastFailedAt: failed[0]?.finishedOn ? new Date(failed[0].finishedOn).toISOString() : null, lastRun: Object.keys(run).length ? run : null };
      }));
      return out;
    },
    close: async () => { await Promise.all(ALL_QUEUES.map((name) => queues[name].close())); },
  };
}
export type Queues = ReturnType<typeof createQueues>;
