import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import { makeAuthenticate, type AccountDeps } from './account';
import { IdCursor, Limit, decodeCursor, encodeCursor, likeEscape } from './paging';
import { ScreenerQuery, isScreenerRequest, runScreener } from './screener';
import { canReadFeature, featureDecision, requireFeature } from './entitlements/access';
import {marketEvidence,observation} from './marketEvidence';
import { tokenHistory } from './tokenHistory';

const n = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));
const Paging = z.object({ limit: Limit, cursor: IdCursor.optional() });
const OppCursor = z.tuple([z.number().finite(), z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)]);

/** Read-only endpoints that feed the UI. Market data is shared and fully read-only. */
export function registerReadRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier' | 'now'>): void {
  const db: PrismaClient = deps.db;
  const now = deps.now ?? (() => new Date());
  const opts = { preHandler: makeAuthenticate(deps), config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };
  const bad = { error: 'INVALID_INPUT' } as const;

  app.get('/v1/narratives', opts, async (req, reply) => {
    const q = z.object({ limit: Limit, cursor: IdCursor.optional(), stage: z.enum(['SEED', 'EMERGING', 'ACCELERATING', 'MAINSTREAM', 'SATURATED', 'DECAYING', 'DEAD']).optional() }).safeParse(req.query);
    if (!q.success) return reply.code(400).send(bad);
    if (q.data.cursor && !(await db.narrative.count({ where: { id: q.data.cursor } }))) return reply.code(400).send(bad);
    const rows = await db.narrative.findMany({
      where: q.data.stage ? { stage: q.data.stage } : {}, orderBy: [{ score: 'desc' }, { id: 'asc' }], take: q.data.limit + 1,
      ...(q.data.cursor ? { cursor: { id: q.data.cursor }, skip: 1 } : {}),
      include: { _count: { select: { tokens: true } } },
    });
    const page = rows.slice(0, q.data.limit);
    return {
      items: page.map(({ _count, summary: _s, ...r }) => ({ ...r, tokenCount: _count.tokens })),
      nextCursor: rows.length > q.data.limit ? page[page.length - 1]!.id : null,
    };
  });

  app.get('/v1/narratives/:slug', opts, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const r = await db.narrative.findUnique({
      where: { slug },
      include: {
        metrics: { orderBy: { at: 'desc' }, take: 1 },
        // Only creators attributed to this narrative, capped so a busy narrative
        // cannot ship an unbounded payload. Originators sort first (enum order).
        creators: { orderBy: [{ role: 'asc' }, { id: 'asc' }], take: 50, include: { creator: { select: { platform: true, handle: true } } } },
        tokens: { orderBy: { ogScore: 'desc' }, take: 20, include: { token: { select: { mint: true, symbol: true, name: true, metrics: { orderBy: { at: 'desc' }, take: 1 } } } } },
      },
    });
    if (!r) return reply.code(404).send({ error: 'NOT_FOUND' });
    const { metrics, creators, tokens, ...narrative } = r;
    return {
      ...narrative, latestMetric: metrics[0] ?? null,
      creators: creators.map((c) => ({ platform: c.creator.platform, handle: c.creator.handle, role: c.role })),
      tokens: tokens.map((t) => {
        const m = t.token.metrics[0];
        return { mint: t.token.mint, symbol: t.token.symbol, name: t.token.name, relation: t.relation, ogScore: t.ogScore, confidence: t.confidence, marketCapUsd: n(m?.marketCapUsd), liquidityUsd: n(m?.liquidityUsd) };
      }),
    };
  });

  app.get('/v1/opportunities', opts, async (req, reply) => {
    const q = z.object({ limit: Limit, cursor: z.string().max(300).optional() }).safeParse(req.query);
    if (!q.success) return reply.code(400).send(bad);
    const after = q.data.cursor ? decodeCursor(q.data.cursor, OppCursor) : null;
    if (q.data.cursor && !after) return reply.code(400).send(bad);
    const me = req.userId!;
    const shared = await canReadFeature(db, me, 'research.opportunities', now(), entry => req.log.info(entry, 'research access decision'));
    if (shared) q.data.limit = Math.min(q.data.limit, (await featureDecision(db, me, 'research.opportunities', now())).pageLimit);
    // Newest 500, then the latest per token, then best score first (ties by id). Pages are cut from that list, so the list is
    // limited to the newest 500 opportunities however far a client pages.
    const rows = await db.opportunity.findMany({
      where: shared ? {} : { analyses: { some: { decisions: { some: { userId: me } } } } },
      orderBy: { createdAt: 'desc' }, take: 500,
      include: {
        token: { select: { mint: true, symbol: true, name: true, metrics: { orderBy: { at: 'desc' }, take: 1 } } },
        narrative: { select: { name: true, slug: true, stage: true } },
        analyses: { where: shared ? {} : { decisions: { some: { userId: me } } }, orderBy: { createdAt: 'desc' }, take: 1, include: { decisions: { where: shared ? { OR: [{ userId: null }, { userId: me }] } : { userId: me }, orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
    });
    const seen = new Set<string>();
    const latest = rows.filter((r) => (seen.has(r.tokenId) ? false : (seen.add(r.tokenId), true)));
    latest.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const rest = after ? latest.filter((o) => o.score < after[0] || (o.score === after[0] && o.id > after[1])) : latest;
    const page = rest.slice(0, q.data.limit);
    const lastRow = page[page.length - 1];
    return {
      nextCursor: rest.length > q.data.limit && lastRow ? encodeCursor([lastRow.score, lastRow.id]) : null,
      items: page.map((o) => {
        const m = o.token.metrics[0];
        const d = o.analyses[0]?.decisions[0];
        return {
          id: o.id, createdAt: o.createdAt, score: o.score,
          scores: { narrative: o.narrativeScore, liquidity: o.liquidityScore, momentum: o.momentumScore, og: o.ogScore, risk: o.riskScore },
          attentionGrowth: o.attentionGrowth, priceGrowth: o.priceGrowth,
          token: { mint: o.token.mint, symbol: o.token.symbol, name: o.token.name, priceUsd: n(m?.priceUsd), marketCapUsd: n(m?.marketCapUsd), liquidityUsd: n(m?.liquidityUsd) },
          narrative: o.narrative, decision: d ? { action: d.action, confidence: d.confidence } : null,
        };
      }),
    };
  });

  // The explainable view: why the AI decided what it did, with the bull, bear and risk arguments and the rules that limited it.
  app.get('/v1/opportunities/:id/analysis', opts, async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = req.userId!;
    const own = await db.agentAnalysis.findFirst({ where: { opportunityId: id, decisions: { some: { userId: me } } }, orderBy: { createdAt: 'desc' }, include: { decisions: { where: { userId: me }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!own) { await requireFeature(db, 'research.analysis', now)(req, reply); if (reply.sent) return; }
    const a = own ?? await db.agentAnalysis.findFirst({
      where: { opportunityId: id }, orderBy: { createdAt: 'desc' },
      include: { decisions: { where: { OR: [{ userId: null }, { userId: me }] }, orderBy: [{ userId: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], take: 1 } },
    });
    const d = a?.decisions[0];
    if (!a || !d) return reply.code(404).send({ error: 'NOT_FOUND' });
    const p = d.payload as { decision: Record<string, unknown>; guardrails: string[]; judge: unknown };
    return {
      opportunityId: id, analyzedAt: a.createdAt, model: a.model,
      fast: a.fastClassification ? { classification: a.fastClassification, score: a.fastScore } : null,
      bull: a.bullCase, bear: a.bearCase, risk: a.riskCase, judge: p.judge ?? null,
      decision: p.decision, guardrails: p.guardrails,
    };
  });

  // The list, text search and the screener share one route. Without screener filters or a sort it is the simple alphabetical
  // list; with them it filters and sorts on each token's latest readings (see screener.ts).
  app.get('/v1/tokens', opts, async (req, reply) => {
    const q = ScreenerQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ ...bad, fields: [...new Set(q.error.issues.map((i) => i.path.join('.')))] });
    const feature = isScreenerRequest(q.data) ? 'research.screener' : 'research.tokens';
    await requireFeature(db, feature, now)(req, reply); if (reply.sent) return;
    q.data.limit = Math.min(q.data.limit, Number((req.query as { limit?: number }).limit ?? q.data.limit));
    if (isScreenerRequest(q.data)||q.data.verifiedOnly==='true') {
      const r = await runScreener(db, q.data, now());
      if (!r) return reply.code(400).send(bad);
      const evidence=await marketEvidence(db,r.rows.map(t=>t.id));
      return {
        items: r.rows.map((t) => ({
          mint: t.mint, symbol: t.symbol, name: t.name, blacklisted: t.blacklisted, createdOnChainAt: t.createdOnChainAt,
          priceUsd: n(t.priceUsd as never), marketCapUsd: n(t.marketCapUsd as never), liquidityUsd: n(t.liquidityUsd as never), volume24hUsd: n(t.volume24hUsd as never),
          holders: t.holders, top10Pct: t.top10Pct, riskScore: t.riskScore, ogScore: t.ogScore,
          observation:observation(evidence.get(t.id),t.metricId??undefined,now()),
        })),
        nextCursor: r.nextCursor,
      };
    }
    const term = q.data.q ? likeEscape(q.data.q) : undefined;
    const cursor = q.data.cursor;
    if (cursor && (!IdCursor.safeParse(cursor).success || !(await db.token.count({ where: { id: cursor } })))) return reply.code(400).send(bad);
    const rows = await db.token.findMany({
      where: term ? { OR: [{ symbol: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }, { mint: { startsWith: term } }] } : {},
      take: q.data.limit + 1, orderBy: [{ symbol: 'asc' }, { id: 'asc' }], ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { metrics: { orderBy: { at: 'desc' }, take: 1 } },
    });
    const page = rows.slice(0, q.data.limit);
    return {
      items: page.map((t) => ({ mint: t.mint, symbol: t.symbol, name: t.name, priceUsd: n(t.metrics[0]?.priceUsd), marketCapUsd: n(t.metrics[0]?.marketCapUsd), liquidityUsd: n(t.metrics[0]?.liquidityUsd) })),
      nextCursor: rows.length > q.data.limit ? page[page.length - 1]!.id : null,
    };
  });

  app.get('/v1/tokens/:mint/history', opts, async (req, reply) => {
    const params = z.object({ mint: z.string().min(1).max(80) }).safeParse(req.params);
    const query = z.object({ window: z.enum(['1h', '24h', '7d']).default('24h') }).safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send(bad);
    await requireFeature(db, 'research.tokens', now)(req, reply); if (reply.sent) return;
    const token = await db.token.findUnique({ where: { mint: params.data.mint }, select: { id: true } });
    if (!token) return reply.code(404).send({ error: 'NOT_FOUND' });
    return tokenHistory(db, token.id, query.data.window, now());
  });

  app.get('/v1/tokens/:mint', opts, async (req, reply) => {
    const { mint } = req.params as { mint: string };
    const t = await db.token.findUnique({
      where: { mint },
      include: {
        metrics: { orderBy: { at: 'desc' }, take: 1 }, holders: { orderBy: { at: 'desc' }, take: 1 }, risk: { orderBy: { at: 'desc' }, take: 1 },
        narratives: { include: { narrative: { select: { name: true, slug: true, stage: true } } } },
      },
    });
    if (!t) return reply.code(404).send({ error: 'NOT_FOUND' });
    const m = t.metrics[0];
    const evidence=await marketEvidence(db,[t.id]);
    return {
      mint: t.mint, symbol: t.symbol, name: t.name, blacklisted: t.blacklisted, createdOnChainAt: t.createdOnChainAt,
      observation:observation(evidence.get(t.id),m?.id,now()),
      metrics: m ? { priceUsd: n(m.priceUsd), marketCapUsd: n(m.marketCapUsd), liquidityUsd: n(m.liquidityUsd), volume24hUsd: n(m.volume24hUsd), at: m.at } : null,
      holders: t.holders[0] ?? null, risk: t.risk[0] ?? null,
      narratives: t.narratives.map((r) => ({ ...r.narrative, relation: r.relation, ogScore: r.ogScore })),
    };
  });
}
