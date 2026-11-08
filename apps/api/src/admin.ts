import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@narra/database';
import { AiConfigSchema } from '@narra/ai';
import { aiEnabled, loadAiConfig, saveAiConfig, setAiEnabled, tokensUsedToday } from '@narra/worker-pipeline';
import { makeRequireAdmin, type AccountDeps } from './account';
import { IdCursor, Limit } from './paging';

/** Re-exported so every admin route keeps importing the gate from here. The implementation lives in `account.ts`, which is
 * the only module the entitlement and runtime admin routes are allowed to depend on. */
export { makeRequireAdmin };

/** Admin-only settings. Model names and limits are editable. API keys are not settings and never pass through here. */
export interface ConnectionStatus {
  /** Provider name, for example near-rpc or privy. */
  name: string;
  /** True when every setting the provider needs is present. The value of a setting is never part of this. */
  configured: boolean;
  /** What the provider is used for, in plain words. */
  purpose: string;
}

export function registerAdminRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier'> & { /** Reports which external providers are configured. */ connections?: () => ConnectionStatus[] }): void {
  const db: PrismaClient = deps.db;
  const requireAdmin = makeRequireAdmin(deps);
  const opts = { preHandler: requireAdmin, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  // Which external providers are set up, as yes or no. Keys and URLs are server-side secrets and are never returned, so there is
  // nothing here to leak and nothing to edit; this only answers "is it configured".
  app.get('/v1/admin/connections', opts, async () => ({ items: (deps.connections?.() ?? []).map((c) => ({ name: c.name, configured: c.configured === true, purpose: c.purpose })) }));

  app.get('/v1/admin/ai-models', opts, async () => ({ config: await loadAiConfig(db), enabled: await aiEnabled(db), tokensUsedToday: await tokensUsedToday(db, new Date()) }));

  app.put('/v1/admin/ai-models', opts, async (req, reply) => {
    // strict: an unknown field such as apiKey is refused, not silently stored
    const body = AiConfigSchema.strict().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'INVALID_INPUT', fields: [...new Set(body.error.issues.flatMap((i) => (i.path.length ? [i.path.join('.')] : (i as { keys?: string[] }).keys ?? [])))] });
    await saveAiConfig(db, body.data);
    await db.auditLog.create({ data: { userId: req.userId!, action: 'ai_config.changed', detail: { fastModel: body.data.fastModel, reasoningModel: body.data.reasoningModel, judgeModel: body.data.judgeModel } } });
    return { config: body.data };
  });

  app.put('/v1/admin/ai-enabled', opts, async (req, reply) => {
    const body = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    await setAiEnabled(db, body.data.enabled);
    await db.auditLog.create({ data: { userId: req.userId!, action: body.data.enabled ? 'ai.enabled' : 'ai.disabled' } });
    return { enabled: body.data.enabled };
  });
}
