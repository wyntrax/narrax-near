import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getBrand } from '@narra/shared';
import type { PrismaClient } from '@narra/database';
import { registerAccountRoutes, type AccountDeps } from './account';
import { registerReadRoutes } from './read';
import { registerSmartMoneyRoutes } from './smartMoney';
import { registerAdminRoutes, type ConnectionStatus } from './admin';
import { registerChatRoutes } from './chat';
import { registerAnalyticsRoutes } from './analytics';
import { registerAdminOpsRoutes } from './adminOps';
import { registerAdminStatusRoutes, type OpsDeps } from './adminStatus';
import type { LlmProvider } from '@narra/ai';
import { HTTP_LIMITS, registerHttpHardening, type HttpOptions } from './http';
import { registerAlertRoutes } from './alerts';
import { registerSettingsRoutes } from './settings';
import { registerOverviewRoutes } from './overview';
import { registerGateway, type GatewayDeps } from './gateway';
import { registerFeatureGates } from './entitlements/gating';
import { registerEntitlementRoutes } from './entitlements/routes';
import { createRuntimeSettings, type RuntimeSettingsResolver } from './runtime-settings';
import { registerRuntimeRoutes } from './runtime-routes';
import { registerPersonalResearchRoutes } from './personalResearch';
import { registerPublicResearchSnapshot } from './publicResearchSnapshot';
import { registerAgentRiskRoutes } from './agentRisk';
import type { ContractSafetySource } from './contractSafety';

export async function buildApp(opts: {
  account?: AccountDeps;
  /** Database for public-only routes when no authenticated account deps are wired. */
  publicDb?: PrismaClient;
  /** Read-only contract facts for the agent risk gate. Without it the gate omits contract checks. */
  contractSafety?: ContractSafetySource;
  /** Skip runtime settings and authenticated routes. Used by the judge demo API. */
  publicOnly?: boolean;
  runtime?: RuntimeSettingsResolver;
  /** The model behind agent chat. Without it chat answers 503. */
  chatLlm?: LlmProvider | null;
  chatQuestionsPerMinute?: number;
  /** Health checks for the admin status view. */
  ops?: OpsDeps;
  /** CORS, HSTS. */
  http?: HttpOptions;
  /** Reports which providers are configured, for the admin connections view. */
  connections?: () => ConnectionStatus[];
  /** WebSocket gateway. Without it GET /v1/stream does not exist. */
  realtime?: Omit<GatewayDeps, 'db' | 'verifier' | 'allowedOrigins' | 'resolveAllowedOrigins'>;
  /** Set when the API sits behind a reverse proxy, so rate limits see the client address and not the proxy's. Never true when the API is exposed directly. */
  trustProxy?: boolean;
} = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization'] },
    bodyLimit: HTTP_LIMITS.bodyLimitBytes, requestTimeout: HTTP_LIMITS.requestTimeoutMs, keepAliveTimeout: HTTP_LIMITS.keepAliveTimeoutMs,
    trustProxy: opts.trustProxy ?? false,
  });
  await registerHttpHardening(app, opts.http);
  await app.register(rateLimit, {
    max: 120, timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => Object.assign(new Error('rate limit exceeded'), { statusCode: 429, code: 'RATE_LIMITED', retryAfter: Math.ceil(ctx.ttl / 1000) }),
  });

  app.get('/health', async () => ({ status: 'ok', brand: getBrand().name }));
  if (!opts.publicOnly) {
    registerRuntimeRoutes(app, opts.runtime ?? (opts.account ? createRuntimeSettings(opts.account.db) : undefined), opts.account);
  }

  // Public routes are independent of sign-in. The judge demo API uses them without Privy.
  const publicDb = opts.publicDb ?? opts.account?.db;
  if (publicDb) {
    registerPublicResearchSnapshot(app, publicDb, opts.account?.now);
    registerAgentRiskRoutes(app, { db: publicDb, contracts: opts.contractSafety, now: opts.account?.now });
  }

  if (opts.account) {
    registerFeatureGates(app, opts.account.db, opts.account.now);
    registerPersonalResearchRoutes(app, opts.account);
    registerEntitlementRoutes(app, opts.account);
    registerAccountRoutes(app, opts.account);
    registerReadRoutes(app, opts.account);
    registerSmartMoneyRoutes(app, opts.account);
    registerAdminRoutes(app, { ...opts.account, connections: opts.connections });
    registerAlertRoutes(app, opts.account);
    registerSettingsRoutes(app, opts.account);
    registerOverviewRoutes(app, opts.account);
    registerAnalyticsRoutes(app, opts.account);
    registerAdminOpsRoutes(app, opts.account);
    registerAdminStatusRoutes(app, { ...opts.account, ops: opts.ops });
    if (opts.realtime) await registerGateway(app, { ...opts.realtime, db: opts.account.db, verifier: opts.account.verifier, allowedOrigins: opts.http?.corsOrigins, resolveAllowedOrigins: opts.http?.resolveCorsOrigins });
    registerChatRoutes(app, { ...opts.account, llm: opts.chatLlm ?? null, questionsPerMinute: opts.chatQuestionsPerMinute });
  }

  return app;
}
