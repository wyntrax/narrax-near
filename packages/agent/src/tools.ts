import { z } from 'zod';
import { isNearAccountId, wrapUntrusted, type UntrustedField } from '@narra/shared';
import { AGENT_LIMITS } from './constants';
import type { AgentPorts } from './ports';

export interface AgentContext { userId: string; now: Date; conversationId: string | null }

/**
 * What a tool hands back. `facts` holds numbers, enums and ids we generated or validated. Anything that came from outside
 * (token names, symbols, model-written summaries, alert text) goes ONLY in `untrusted`, wrapped and sanitized.
 */
export interface ToolOutput { facts: Record<string, unknown>; untrusted?: UntrustedField[]; error?: string }

export interface Tool {
  name: string;
  description: string;
  /** Plain-text argument summary for the system prompt. */
  argsHelp: string;
  schema: z.ZodTypeAny;
  run(ports: AgentPorts, ctx: AgentContext, args: unknown): Promise<ToolOutput>;
}

function defineTool<S extends z.ZodTypeAny>(t: { name: string; description: string; argsHelp: string; schema: S; run: (p: AgentPorts, c: AgentContext, a: z.infer<S>) => Promise<ToolOutput> }): Tool {
  return { ...t, run: (p, c, a) => t.run(p, c, a as z.infer<S>) };
}

// A NEAR account id is the only free-form identifier a model can pass, and it can only look something up.
const contract = z.string().min(2).max(64).refine(isNearAccountId, 'invalid NEAR account id');
const slug = z.string().min(1).max(128).regex(/^[a-z0-9-]+$/);
const limit = (max: number, dflt: number) => z.number().int().min(1).max(max).default(dflt);
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const text = (source: string, s: string, max = 200) => wrapUntrusted(source, s, max);
const num = (n: number | null) => (n == null || !Number.isFinite(n) ? null : n);

/**
 * Facts are built field by field. Never spread an object from a port into facts: a field added to it later, or a free-text
 * field that should have been wrapped, would then reach the model as if it were trusted.
 */
const SCORES = ['score', 'narrativeScore', 'liquidityScore', 'momentumScore', 'riskScore'] as const;
const scores = (o: Record<(typeof SCORES)[number], number>) => ({
  score: o.score, narrativeScore: o.narrativeScore, liquidityScore: o.liquidityScore,
  momentumScore: o.momentumScore, riskScore: o.riskScore,
});

export const TOOLS: Tool[] = [
  defineTool({
    name: 'list_narratives', description: 'The strongest live narratives the system is tracking, ranked by score.',
    argsHelp: '{"limit"?: 1-10}', schema: z.object({ limit: limit(10, 5) }).strict(),
    async run(p, _c, a) {
      const rows = await p.listNarratives(a.limit);
      return {
        facts: { count: rows.length, items: rows.map((n) => ({ slug: n.slug, stage: n.stage, score: n.score, velocity: n.velocity, acceleration: n.acceleration, organicScore: n.organicScore, saturationRisk: n.saturationRisk, at: iso(n.updatedAt) })) },
        untrusted: rows.flatMap((n, i) => [text(`narrative[${i}].name`, n.name, 80), ...(n.summary ? [text(`narrative[${i}].summary`, n.summary, 400)] : [])]),
      };
    },
  }),
  defineTool({
    name: 'get_narrative', description: 'One narrative by slug: stage, attention scores and the stored summary.',
    argsHelp: '{"slug": narrative slug}', schema: z.object({ slug }).strict(),
    async run(p, _c, a) {
      const n = await p.getNarrative(a.slug);
      if (!n) return { facts: {}, error: 'not_found' };
      return {
        facts: { slug: n.slug, stage: n.stage, score: n.score, velocity: n.velocity, acceleration: n.acceleration, organicScore: n.organicScore, saturationRisk: n.saturationRisk, at: iso(n.updatedAt) },
        untrusted: [text('narrative.name', n.name, 80), ...(n.summary ? [text('narrative.summary', n.summary, 400)] : [])],
      };
    },
  }),
  defineTool({
    name: 'list_opportunities', description: 'The highest-scoring recent opportunities the system has found (all users see the same list).',
    argsHelp: '{"limit"?: 1-10}', schema: z.object({ limit: limit(10, 5) }).strict(),
    async run(p, _c, a) {
      const rows = await p.listOpportunities(a.limit);
      return {
        facts: { count: rows.length, items: rows.map((r, i) => ({ ref: i, mint: r.mint, ...scores(r), at: iso(r.createdAt) })) },
        untrusted: rows.flatMap((r, i) => [text(`opportunity[${i}].symbol`, r.symbol, 32), text(`opportunity[${i}].name`, r.name, 64)]),
      };
    },
  }),
  defineTool({
    name: 'get_token', description: 'Latest price, liquidity, volume and opportunity score for one NEP-141 token contract.',
    argsHelp: '{"mint": NEAR account id of the token contract}', schema: z.object({ mint: contract }).strict(),
    async run(p, _c, a) {
      const t = await p.getToken(a.mint);
      if (!t) return { facts: {}, error: 'not_found' };
      return {
        facts: {
          mint: t.mint, blacklisted: t.blacklisted,
          metric: t.metric && { priceUsd: t.metric.priceUsd, liquidityUsd: t.metric.liquidityUsd, volume24hUsd: t.metric.volume24hUsd, marketCapUsd: t.metric.marketCapUsd, at: iso(t.metric.at) },
          opportunity: t.opportunity && { ...scores(t.opportunity), at: iso(t.opportunity.createdAt) },
        },
        untrusted: [text('token.symbol', t.symbol, 32), text('token.name', t.name, 64)],
      };
    },
  }),
  defineTool({
    name: 'get_recent_decisions', description: 'Recent AI decisions about a token (BUY, WATCH, AVOID) with reason codes and, once known, what the price did afterwards.',
    argsHelp: '{"mint": NEAR account id of the token contract, "limit"?: 1-10}', schema: z.object({ mint: contract, limit: limit(10, 5) }).strict(),
    async run(p, _c, a) {
      const rows = await p.recentDecisions(a.mint, a.limit);
      return {
        facts: { count: rows.length, items: rows.map((d) => ({ id: d.id, action: d.action, confidence: d.confidence, reasonCodes: d.reasonCodes.filter((c) => /^[A-Z0-9_]{2,48}$/.test(c)), at: iso(d.createdAt), outcome: d.outcome && { label: d.outcome.label, returnPct24h: num(d.outcome.returnPct24h), isFinal: d.outcome.isFinal } })) },
        untrusted: rows.map((d, i) => text(`decision[${i}].summary`, d.summary, 300)),
      };
    },
  }),
  defineTool({
    name: 'get_my_alerts', description: "The signed-in user's recent research alerts.",
    argsHelp: '{"limit"?: 1-20}', schema: z.object({ limit: limit(20, 10) }).strict(),
    async run(p, c, a) {
      const rows = await p.myAlerts(c.userId, a.limit);
      return {
        facts: { count: rows.length, items: rows.map((x, i) => ({ ref: i, id: x.id, kind: x.kind, priority: x.priority, at: iso(x.createdAt) })) },
        untrusted: rows.flatMap((x, i) => [text(`alert[${i}].title`, x.title, 120), text(`alert[${i}].body`, x.body, 300)]),
      };
    },
  }),
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
export const findTool = (name: string) => TOOLS.find((t) => t.name === name);
