import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import {
  DEFAULT_ROUND_TRIP_COST_PCT, GATES, calibrateByBucket, calibrateBySignal, dedupeEvents, describeReturns, insufficiencyNote, quantile, type Item,
} from '@narra/analytics';
import { AgentDecisionSchema } from '@narra/shared';
import { makeAuthenticate, type AccountDeps } from './account';
import { IdCursor, Limit, decodeCursor, encodeCursor } from './paging';

const DAY = 86_400_000;
/** Most outcomes one request will read. A bigger range is cut and says so (`truncated`). Starting value. */
const MAX_OUTCOME_ROWS = 5000;

const Range = z.object({ days: z.coerce.number().int().min(1).max(365).default(30), costPct: z.coerce.number().min(0).max(20).default(DEFAULT_ROUND_TRIP_COST_PCT) });
const Action = z.enum(['BUY', 'WATCH', 'IGNORE', 'SELL', 'REDUCE', 'HOLD']);
const SummaryQuery = Range.extend({ action: Action.default('BUY') });
// Optional filters preserve existing unfiltered API clients. The analytics page always sends both.
const OutcomesQuery = z.object({ limit: Limit, cursor: z.string().max(300).optional(), final: z.enum(['true', 'false']).optional(), action: Action.optional(), days: Range.shape.days.optional() });
const CursorShape = z.tuple([z.string().datetime(), IdCursor]);

const iso = (d: Date) => d.toISOString();

export const ANALYTICS_CAVEATS = [
  'Outcomes are price moves from stored readings. They are not executable returns: fees, price impact and liquidity are not modeled.',
  `A number is only called reliable with at least ${GATES.minSample} independent events across ${GATES.minDistinctTokens} tokens. Below that it is shown and marked insufficient.`,
  'Tokens that rug often stop being tracked, so missing 24h prices are not random. The unknown rate is shown beside every result.',
  'Everything comes from the period the system has been running, usually a single market regime.',
] as const;

/**
 * Read-only views of what B6 measures: how decisions turned out, how reasons and confidence line up with outcomes,
 * and how reasons and confidence line up with outcomes. Nothing here writes, and nothing here changes a limit or a threshold.
 * Token symbols are untrusted text: clients must render them as plain text.
 */
export function registerAnalyticsRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier' | 'now'>): void {
  const db: PrismaClient = deps.db;
  const now = deps.now ?? (() => new Date());
  const rl = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
  const user = { preHandler: makeAuthenticate(deps), ...rl };
  const bad = { error: 'INVALID_INPUT' } as const;

  /** Measured global decisions in range, including pending/unknown; one per token per 24h. */
  async function loadOutcomes(days: number, action: z.infer<typeof Action>) {
    const to = now(), from = new Date(to.getTime() - days * DAY);
    const rows = await db.decisionOutcome.findMany({
      where: { decision: { userId: null, action, createdAt: { gte: from, lte: to } } },
      orderBy: [{ decision: { createdAt: 'desc' } }, { id: 'desc' }], take: MAX_OUTCOME_ROWS,
      include: { decision: { select: { createdAt: true, confidence: true, payload: true, analysis: { select: { opportunity: { select: { tokenId: true } } } } } } },
    });
    const events = rows.map((r) => ({ tokenId: r.decision.analysis.opportunity.tokenId, at: r.decision.createdAt, r }));
    return { from, to, truncated: rows.length === MAX_OUTCOME_ROWS, raw: rows.length, events: dedupeEvents(events) };
  }

  app.get('/v1/analytics/decisions/summary', user, async (req, reply) => {
    const q = SummaryQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(bad);
    const { from, to, truncated, raw, events } = await loadOutcomes(q.data.days, q.data.action);
    const scope = { userId: null, action: q.data.action, createdAt: { gte: from, lte: to } };
    const [total, awaitingMeasurement] = await Promise.all([
      db.agentDecision.count({ where: scope }),
      db.agentDecision.count({ where: { ...scope, outcome: null } }),
    ]);
    const costPct = q.data.action === 'BUY' ? q.data.costPct : 0;
    const final = events.filter((e) => e.r.isFinal), known = final.filter((e) => e.r.returnPct24h != null && e.r.label !== 'UNKNOWN');
    const unknown = final.length - known.length;
    const items = known.map((e): Item => ({ tokenId: e.tokenId, ret: (e.r.returnPct24h as number) - costPct }));
    const labels = { WIN: 0, LOSS: 0, FLAT: 0 };
    for (const e of known) labels[e.r.label as keyof typeof labels]++;
    const leads = known.map((e) => e.r.leadTimeSeconds).filter((x): x is number => x != null).sort((a, b) => a - b);
    const withConf = known.map((e): Item & { key: number } => ({ tokenId: e.tokenId, ret: (e.r.returnPct24h as number) - costPct, key: e.r.decision.confidence }));
    const described = describeReturns(items);
    return {
      range: { from: iso(from), to: iso(to), days: q.data.days }, action: q.data.action, costPct,
      decisions: { total, awaitingMeasurement, read: raw, independent: events.length, pending: events.length - final.length, final: final.length, known: known.length, unknown, unknownRate: final.length ? unknown / final.length : null, truncated },
      labels, returns: described, medianLeadTimeSeconds: quantile(leads, 0.5),
      byConfidence: calibrateByBucket(withConf, [0.6, 0.7, 0.8, 0.9, 1]),
      evidence: { sufficient: described.sufficient, note: described.note },
      caveats: ANALYTICS_CAVEATS,
    };
  });

  app.get('/v1/analytics/signals', user, async (req, reply) => {
    const q = SummaryQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(bad);
    const { events, truncated } = await loadOutcomes(q.data.days, q.data.action);
    const costPct = q.data.action === 'BUY' ? q.data.costPct : 0;
    const known = events.filter((e) => e.r.isFinal && e.r.returnPct24h != null && e.r.label !== 'UNKNOWN');
    const items = known.map((e) => {
      const p = AgentDecisionSchema.safeParse(e.r.decision.payload);
      return { tokenId: e.tokenId, ret: (e.r.returnPct24h as number) - costPct, codes: p.success ? p.data.reasonCodes : [] };
    });
    return { action: q.data.action, costPct, truncated, byReasonCode: calibrateBySignal(items), caveats: ANALYTICS_CAVEATS };
  });

  app.get('/v1/analytics/decisions/outcomes', user, async (req, reply) => {
    const q = OutcomesQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(bad);
    let cur: z.infer<typeof CursorShape> | null = null;
    if (q.data.cursor) { cur = decodeCursor(q.data.cursor, CursorShape); if (!cur) return reply.code(400).send(bad); }
    const to = now();
    const rows = await db.decisionOutcome.findMany({
      where: {
        decision: { userId: null, ...(q.data.action ? { action: q.data.action } : {}), ...(q.data.days ? { createdAt: { gte: new Date(to.getTime() - q.data.days * DAY), lte: to } } : {}), ...(cur ? { OR: [{ createdAt: { lt: new Date(cur[0]) } }, { createdAt: new Date(cur[0]), id: { lt: cur[1] } }] } : {}) },
        ...(q.data.final ? { isFinal: q.data.final === 'true' } : {}),
      },
      orderBy: [{ decision: { createdAt: 'desc' } }, { decisionId: 'desc' }], take: q.data.limit + 1,
      include: { decision: { select: { id: true, action: true, confidence: true, createdAt: true, analysis: { select: { opportunity: { select: { token: { select: { mint: true, symbol: true } } } } } } } } },
    });
    const page = rows.slice(0, q.data.limit), last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        decisionId: r.decisionId, action: r.decision.action, confidence: r.decision.confidence, decidedAt: r.decision.createdAt,
        token: { mint: r.decision.analysis.opportunity.token.mint, symbol: r.decision.analysis.opportunity.token.symbol }, // symbol is untrusted text
        label: r.label, return1hPct: r.returnPct1h, return24hPct: r.returnPct24h, maxGainPct: r.maxGainPct, maxDrawdownPct: r.maxDrawdownPct,
        leadTimeSeconds: r.leadTimeSeconds, isFinal: r.isFinal, unknownReason: r.unknownReason, measuredAt: r.measuredAt,
      })),
      nextCursor: rows.length > q.data.limit && last ? encodeCursor([last.decision.createdAt.toISOString(), last.decisionId]) : null,
    };
  });
}
