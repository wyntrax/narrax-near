import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@narra/database';
import type { LlmProvider } from '@narra/ai';
import { AGENT_LIMITS, runAgent, sanitizeUserText } from '@narra/agent';
import { aiEnabled, loadAiConfig } from '@narra/worker-pipeline';
import { makeAuthenticate, type AccountDeps } from './account';
import { makeAgentPorts } from './chatPorts';
import { researchPorts } from './entitlements/chatAccess';

const Body = z.object({ conversationId: z.string().min(1).max(64).optional(), message: z.string().min(1).max(AGENT_LIMITS.maxUserMessageChars) }).strict();
const IdParams = z.object({ id: z.string().min(1).max(64) });
const Page = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export interface ChatDeps extends Pick<AccountDeps, 'db' | 'verifier' | 'now'> {
  /** Null when no model provider is configured: chat then answers 503 and nothing else changes. */
  llm: LlmProvider | null;
  /** Chat questions allowed per minute per client address. Tests raise it; production keeps the default. */
  questionsPerMinute?: number;
}

/**
 * Agent chat. The agent can read research data and explain it; it has no way to trade, sign or touch a wallet
 * (see packages/agent). Tool results are never stored and are replayed only inside one turn.
 */
export function registerChatRoutes(app: FastifyInstance, deps: ChatDeps): void {
  const db: PrismaClient = deps.db;
  const now = deps.now ?? (() => new Date());
  const ports = makeAgentPorts(db);
  const auth = makeAuthenticate(deps);
  const opts = { preHandler: auth, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
  // The Agent has its own 45s turn budget. This route-level deadline is a final safety net for a slow tool or
  // database call, and stays below the frontend's 55s request timeout and nginx's usual 60s read timeout.
  const chatOpts = { preHandler: auth, handlerTimeout: AGENT_LIMITS.turnTimeoutMs + 5_000, config: { rateLimit: { max: deps.questionsPerMinute ?? 20, timeWindow: '1 minute' } } };
  const busy = new Set<string>(); // one question at a time per user, per process

  app.post('/v1/chat', chatOpts, async (req, reply) => {
    const body = Body.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const message = sanitizeUserText(body.data.message);
    if (!message) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const userId = req.userId!, at = now();
    if (!deps.llm || !(await aiEnabled(db))) return reply.code(503).send({ error: 'CHAT_UNAVAILABLE' });
    if (busy.has(userId)) return reply.code(429).send({ error: 'CHAT_BUSY' });
    busy.add(userId);
    try {
      const cfg = await loadAiConfig(db), since = startOfUtcDay(at);
      const sum = (a: { _sum: { inputTokens: number | null; outputTokens: number | null } }) => (a._sum.inputTokens ?? 0) + (a._sum.outputTokens ?? 0);
      const [all, mine, sent] = await Promise.all([
        db.chatMessage.aggregate({ where: { role: 'ASSISTANT', createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true } }),
        db.chatMessage.aggregate({ where: { userId, role: 'ASSISTANT', createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true } }),
        db.chatMessage.count({ where: { userId, role: 'USER', createdAt: { gte: since } } }),
      ]);
      if (sum(all) >= cfg.chatTokenBudget) return reply.code(429).send({ error: 'CHAT_BUDGET_EXHAUSTED' });
      if (sum(mine) >= cfg.chatTokensPerUserPerDay) return reply.code(429).send({ error: 'CHAT_USER_BUDGET_EXHAUSTED' });
      if (sent >= AGENT_LIMITS.maxUserMessagesPerDay) return reply.code(429).send({ error: 'CHAT_DAILY_LIMIT' });

      let conversationId = body.data.conversationId ?? null, history: { role: 'user' | 'assistant'; text: string }[] = [];
      if (conversationId) {
        const conv = await db.chatConversation.findFirst({ where: { id: conversationId, userId }, select: { id: true } });
        if (!conv) return reply.code(404).send({ error: 'NOT_FOUND' });
        if ((await db.chatMessage.count({ where: { conversationId } })) >= AGENT_LIMITS.maxMessagesPerConversation) return reply.code(409).send({ error: 'CONVERSATION_FULL' });
        const prior = await db.chatMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: AGENT_LIMITS.historyMessages });
        history = prior.reverse().map((m) => ({ role: m.role === 'USER' ? 'user' : 'assistant', text: m.content }));
      } else conversationId = (await db.chatConversation.create({ data: { userId } })).id;

      await db.chatMessage.create({ data: { conversationId, userId, role: 'USER', content: message, createdAt: at } });
      const result = await runAgent({ llm: deps.llm, model: cfg.fastModel, temperature: cfg.temperature, maxTokens: cfg.maxTokensPerCall, ports: researchPorts(ports, db, userId, now, entry => req.log.info(entry, 'research access decision')), ctx: { userId, now: at, conversationId }, userMessage: message, history });
      // The user sees a fixed fallback. The operator needs the reason (bad key, wrong base URL, unknown model id), so it is logged here: fixed provider text only, never a body or key.
      if (result.llmError) req.log.warn({ llmError: result.llmError, model: cfg.fastModel }, 'chat model call failed');
      await db.$transaction([
        db.chatMessage.create({
          data: {
            conversationId, userId, role: 'ASSISTANT', content: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: cfg.fastModel, createdAt: new Date(now().getTime() + 1),
            meta: { toolsUsed: result.toolsUsed, refusedCalls: result.refusedCalls, stopReason: result.stopReason, ...(result.llmError ? { llmError: result.llmError } : {}) } as Prisma.InputJsonValue,
          },
        }),
        db.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: now() } }),
      ]);
      return { conversationId, reply: { text: result.text, format: 'text' as const }, toolsUsed: result.toolsUsed, stopReason: result.stopReason };
    } finally { busy.delete(userId); }
  });

  app.get('/v1/chat/conversations', opts, async (req, reply) => {
    const q = Page.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const rows = await db.chatConversation.findMany({ where: { userId: req.userId! }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: q.data.limit });
    return { items: rows.map((c) => ({ id: c.id, createdAt: c.createdAt, updatedAt: c.updatedAt })) };
  });

  app.get('/v1/chat/conversations/:id', opts, async (req, reply) => {
    const p = IdParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const conv = await db.chatConversation.findFirst({ where: { id: p.data.id, userId: req.userId! } });
    if (!conv) return reply.code(404).send({ error: 'NOT_FOUND' });
    const rows = await db.chatMessage.findMany({ where: { conversationId: conv.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: AGENT_LIMITS.maxMessagesPerConversation });
    return { id: conv.id, messages: rows.map((m) => ({ id: m.id, role: m.role, text: m.content, format: 'text' as const, createdAt: m.createdAt })) };
  });
}
