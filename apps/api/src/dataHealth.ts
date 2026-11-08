import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import type { QueueCounts, QueueHealth } from '@narra/queue';
import { aiEnabled, loadAiConfig, tokensUsedToday } from '@narra/worker-pipeline';
import { observation } from './marketEvidence';

const Evidence = z.object({ metricId: z.string(), source: z.literal('dexscreener'), at: z.string().datetime() });
export interface HealthPorts { queueCounts?: () => Promise<Record<string, QueueCounts>>; queueHealth?: () => Promise<Record<string, QueueHealth>>; marketDataEnabled?: boolean; aiProviderConfigured?: boolean }
const QUEUES = ['market-data', 'ai-analysis', 'narrative-ingestion'];
const SCAN_LIMIT = 2000;
const elapsed = (at: string | null, now: Date) => at ? Math.max(0, Math.round((+now - Date.parse(at)) / 1000)) : null;

/** Read-only operational evidence for the research pipeline. */
export async function dataHealth(db: PrismaClient, ports: HealthPorts, now: Date) {
  const recent = new Date(+now - 3_600_000);
  const [tokenCount, tokens, unknownNames, candidateCount, belowThreshold, expiredCount, cfg, aiOn, used] = await Promise.all([
    db.token.count({ where: { blacklisted: false } }),
    db.token.findMany({ where: { blacklisted: false }, orderBy: { id: 'asc' }, take: SCAN_LIMIT, select: { id: true, mint: true, symbol: true, metrics: { orderBy: { at: 'desc' }, take: 1, select: { id: true, at: true } } } }),
    db.token.count({ where: { OR: [{ symbol: 'UNKNOWN' }, { name: 'Unknown' }] } }),
    db.opportunity.count({ where: { createdAt: { gte: recent, lte: now }, score: { gte: 50 }, analyses: { none: {} } } }),
    db.opportunity.count({ where: { createdAt: { gte: recent, lte: now }, score: { lt: 50 }, analyses: { none: {} } } }),
    db.opportunity.count({ where: { createdAt: { lt: recent }, analyses: { none: {} } } }),
    loadAiConfig(db), aiEnabled(db), tokensUsedToday(db, now),
  ]);
  const evidence = await db.systemSetting.findMany({ where: { key: { in: tokens.flatMap(t => t.metrics.map(m => `research.marketMetric.${m.id}`)) } } });
  const sources = new Map(evidence.map(row => [row.key, row.value]));
  const market = { scanned: tokens.length, total: tokenCount, capped: tokenCount > tokens.length, fresh: 0, stale: 0, unverified: 0, lastAt: null as string | null };
  for (const token of tokens) {
    const m = token.metrics[0];
    const src = Evidence.safeParse(m && sources.get(`research.marketMetric.${m.id}`));
    const verified = m && src.success && src.data.metricId === m.id && Date.parse(src.data.at) === +m.at;
    if (!verified) { market.unverified++; continue; }
    const at = new Date(src.data.at);
    if (at > now) { market.unverified++; continue; }
    if (+now - +at > 15 * 60_000) market.stale++; else market.fresh++;
    if (!market.lastAt || at.toISOString() > market.lastAt) market.lastAt = at.toISOString();
  }
  let counts: Record<string, QueueCounts> | null = null, runs: Record<string, QueueHealth> | null = null;
  try { counts = await ports.queueCounts?.() ?? null; } catch { /* Unknown, not an empty healthy queue. */ }
  try { runs = await ports.queueHealth?.() ?? null; } catch { /* Retained-job diagnostics unavailable. */ }
  const queues = QUEUES.map(name => {
    const count = counts?.[name] ?? null, run = runs?.[name] ?? null;
    const enabled = name === 'market-data' ? ports.marketDataEnabled !== false : name === 'ai-analysis' ? aiOn && ports.aiProviderConfigured !== false : true;
    const state = !enabled ? 'DISABLED' : !count ? 'UNKNOWN' : count.consumers === 0 ? 'ERROR' : count.consumers == null ? 'UNKNOWN' : count.failed > 0 || count.waiting > 100 || run?.lastRun?.providerFailures || run?.lastRun?.rateLimited || run?.lastRun?.skipped ? 'WARNING' : 'OK';
    return { name, state, counts: count, lastCompletedAt: run?.lastCompletedAt ?? null, lastFailedAt: run?.lastFailedAt ?? null, lastRun: run?.lastRun ?? null };
  });
  const issues: string[] = [];
  if (!counts) issues.push('QUEUES_UNAVAILABLE');
  if (queues.some(q => q.state === 'ERROR')) issues.push('WORKER_MISSING');
  if (queues.some(q => q.counts && q.counts.failed > 0)) issues.push('RETAINED_FAILURES');
  if (queues.some(q => q.lastRun?.providerFailures)) issues.push('AI_PROVIDER_FAILURES');
  if (queues.some(q => q.name === 'ai-analysis' && q.lastRun?.skipped)) issues.push('AI_RUN_SKIPPED');
  if (queues.some(q => q.lastRun?.rateLimited)) issues.push('PROVIDER_RATE_LIMIT');
  if (ports.marketDataEnabled !== false && (market.stale || market.unverified)) issues.push('MARKET_COVERAGE_GAPS');
  if (unknownNames) issues.push('TOKEN_NAMES_MISSING');
  if ([cfg.fastModel, cfg.reasoningModel].some(model => !model.trim())) issues.push('AI_MODEL_PLACEHOLDER');
  if (!aiOn) issues.push('AI_DISABLED'); else if (ports.aiProviderConfigured === false) issues.push('AI_NOT_CONFIGURED'); else if (used >= cfg.tokenBudget) issues.push('ANALYSIS_BUDGET_EXHAUSTED');
  return {
    checkedAt: now.toISOString(), issues, queues,
    market: { ...market, enabled: ports.marketDataEnabled !== false, unknownNames },
    analysis: { enabled: aiOn, providerConfigured: ports.aiProviderConfigured ?? null, fastModel: cfg.fastModel, reasoningModel: cfg.reasoningModel, usedToday: used, budget: cfg.tokenBudget, recentCandidates: candidateCount, recentBelowThreshold: belowThreshold, olderUnanalyzed: expiredCount },
    freshnessAgeSeconds: market.lastAt ? elapsed(market.lastAt, now) : null,
  };
}
