import type { PrismaClient } from '@narra/database';
import type { AgentPorts } from '@narra/agent';
import { AgentDecisionSchema } from '@narra/shared';

const n = (d: { toString(): string } | null) => (d == null ? null : Number(d.toString()));

/**
 * Prisma-backed ports for the research agent. Reads only. Every personal query is filtered by the user id the route
 * got from the session. There is nothing here that signs, sends, swaps, creates an order or touches a wallet.
 */
export function makeAgentPorts(db: PrismaClient): AgentPorts {
  return {
    async listNarratives(limit) {
      return db.narrative.findMany({ where: { stage: { not: 'DEAD' } }, orderBy: [{ score: 'desc' }, { id: 'asc' }], take: limit, select: { slug: true, name: true, stage: true, score: true, velocity: true, acceleration: true, organicScore: true, saturationRisk: true, summary: true, updatedAt: true } });
    },
    async getNarrative(slug) {
      return db.narrative.findUnique({ where: { slug }, select: { slug: true, name: true, stage: true, score: true, velocity: true, acceleration: true, organicScore: true, saturationRisk: true, summary: true, updatedAt: true } });
    },
    async listOpportunities(limit) {
      const rows = await db.opportunity.findMany({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } }, orderBy: [{ score: 'desc' }, { createdAt: 'desc' }], take: limit * 5, include: { token: { select: { mint: true, symbol: true, name: true } } } });
      const seen = new Set<string>(), out = [];
      for (const r of rows) {
        if (seen.has(r.token.mint)) continue;
        seen.add(r.token.mint);
        out.push({ mint: r.token.mint, symbol: r.token.symbol, name: r.token.name, score: r.score, narrativeScore: r.narrativeScore, liquidityScore: r.liquidityScore, momentumScore: r.momentumScore, riskScore: r.riskScore, createdAt: r.createdAt });
        if (out.length >= limit) break;
      }
      return out;
    },
    async getToken(mint) {
      const t = await db.token.findUnique({ where: { mint }, include: { metrics: { orderBy: { at: 'desc' }, take: 1 }, opportunities: { orderBy: { createdAt: 'desc' }, take: 1 } } });
      if (!t) return null;
      const m = t.metrics[0], o = t.opportunities[0];
      return {
        mint: t.mint, symbol: t.symbol, name: t.name, blacklisted: t.blacklisted,
        metric: m ? { priceUsd: n(m.priceUsd)!, liquidityUsd: n(m.liquidityUsd)!, volume24hUsd: n(m.volume24hUsd)!, marketCapUsd: n(m.marketCapUsd)!, at: m.at } : null,
        opportunity: o ? { score: o.score, narrativeScore: o.narrativeScore, liquidityScore: o.liquidityScore, momentumScore: o.momentumScore, riskScore: o.riskScore, createdAt: o.createdAt } : null,
      };
    },
    async recentDecisions(mint, limit) {
      const rows = await db.agentDecision.findMany({ where: { userId: null, analysis: { opportunity: { token: { mint } } } }, orderBy: { createdAt: 'desc' }, take: limit, include: { outcome: true } });
      return rows.map((d) => {
        const p = AgentDecisionSchema.safeParse(d.payload);
        return { id: d.id, action: d.action, confidence: d.confidence, reasonCodes: p.success ? p.data.reasonCodes : [], summary: p.success ? p.data.summary : '', createdAt: d.createdAt, outcome: d.outcome ? { label: d.outcome.label, returnPct24h: d.outcome.returnPct24h, isFinal: d.outcome.isFinal } : null };
      });
    },
    async myAlerts(userId, limit) {
      return db.alert.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit, select: { id: true, kind: true, priority: true, title: true, body: true, createdAt: true } });
    },
  };
}
