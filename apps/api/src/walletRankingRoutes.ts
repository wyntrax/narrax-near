import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WalletEntryBand } from '@narra/shared';
import { makeAuthenticate, type AccountDeps } from './account';
import { walletRanking } from './walletRanking';

const Query = z.object({
  band: WalletEntryBand.default('ALL'),
  status: z.enum(['ALL', 'REVIEW_READY', 'OBSERVING']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  minMedianPositionSol: z.coerce.number().finite().min(0).max(1_000_000).default(0),
}).strict();

/** Bounded, chain-neutral smart-money rankings over recorded wallet trades. */
export function registerWalletRankingRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier' | 'now'>): void {
  const now = deps.now ?? (() => new Date());
  app.get('/v1/smart-money/rankings', { preHandler: makeAuthenticate(deps), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const q = Query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    return walletRanking(deps.db, now(), q.data.band, q.data.limit, q.data.status, q.data.minMedianPositionSol);
  });
}
