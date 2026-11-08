import type { AgentPorts } from '@narra/agent';
import type { PrismaClient } from '@narra/database';
import { canReadFeature, featureDecision } from './access';

/** Closure binds the authenticated user; model/tool input cannot select identity or feature. */
export function researchPorts(ports: AgentPorts, db: PrismaClient, userId: string, now: () => Date, log?: (entry: object) => void): AgentPorts {
  return {
    ...ports,
    async listNarratives(limit) {
      const d = await featureDecision(db, userId, 'research.narratives', now(), log);
      return d.allowed ? ports.listNarratives(Math.min(limit, d.pageLimit)) : [];
    },
    async getNarrative(slug) {
      return await canReadFeature(db, userId, 'research.narratives', now(), log) ? ports.getNarrative(slug) : null;
    },
    async listOpportunities(limit) {
      const d = await featureDecision(db, userId, 'research.opportunities', now(), log);
      return d.allowed ? ports.listOpportunities(Math.min(limit, d.pageLimit)) : [];
    },
    async getToken(mint) {
      if (!await canReadFeature(db, userId, 'research.tokens', now(), log)) return null;
      const token = await ports.getToken(mint); if (!token) return null;
      return { ...token, opportunity: await canReadFeature(db, userId, 'research.opportunities', now(), log) ? token.opportunity : null };
    },
    async recentDecisions(mint, limit) {
      const d = await featureDecision(db, userId, 'research.decision_analytics', now(), log);
      return d.allowed ? ports.recentDecisions(mint, Math.min(limit, d.pageLimit)) : [];
    },
  };
}
