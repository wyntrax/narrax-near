import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { sanitizeUntrusted } from '@narra/shared';
import { makeAuthenticate, makeRequireAdmin, type AccountDeps } from '../account';
import { AccessError } from './common';
import { accessSettings, entitlementTrace } from './access';
import { localSettings, SETTING_SCHEMAS, updateLocalSettings } from './settings';
import { earlyAccessClosed } from '@narra/shared';
import { grantEarlyAccess, revokeLocalGrant } from './grants';

const Reason = z.string().trim().min(1).max(300).transform(s => sanitizeUntrusted(s, 300).trim()).refine(s => s.length > 0);
const Id = z.string().min(1).max(200);

export function registerEntitlementRoutes(app: FastifyInstance, deps: AccountDeps) {
  const { db } = deps, now = deps.now ?? (() => new Date());
  const auth = makeAuthenticate(deps);
  const handle = (work: (r: FastifyRequest) => Promise<unknown>) => async (req: FastifyRequest, reply: FastifyReply) => {
    try { return await work(req); } catch (e) {
      const status = e instanceof AccessError ? e.status : e instanceof z.ZodError ? 400 : 503;
      return reply.code(status).send({ error: e instanceof AccessError ? e.code : status === 400 ? 'INVALID_INPUT' : 'ENTITLEMENTS_UNAVAILABLE', requestId: req.requestId });
    }
  };
  // Admin routes authenticate and then check the ADMIN_* allowlist in one step. `requireAdminActor` stays the
  // transaction-level backstop used by the entitlement services themselves.
  const opts = (admin = false, max = 30) => ({ bodyLimit: 16384, config: { rateLimit: { max, timeWindow: '1 minute' } }, preHandler: admin ? makeRequireAdmin(deps) : auth });
  const params = (r: FastifyRequest) => z.object({ userId: Id, id: Id.optional() }).parse(r.params);
  type PublicStatus = { enabled: boolean; seatsLeft: number | null; inviteRequired: boolean };
  let publicCache: { until: number; value: PublicStatus } | undefined;
  let publicPending: Promise<PublicStatus> | undefined;

  app.get('/v1/early-access/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const at = now();
      if (!publicCache || publicCache.until <= +at) {
        publicPending ??= db.$transaction(async tx => {
          const settings = await localSettings(tx);
          // An ended time window reads as closed: the same state as disabled, so the existing screens need no new shape.
          settings.enabled = settings.enabled && !earlyAccessClosed(settings.closesAt, at);
          const occupied = settings.enabled ? (await tx.accessGrant.findMany({ where: { source: 'EARLY_ACCESS', tier: 'EARLY_ACCESS', status: 'ACTIVE', OR: [{ validUntil: null }, { validUntil: { gt: at } }] }, distinct: ['userId'], select: { userId: true } })).length : 0;
          return { enabled: settings.enabled, seatsLeft: settings.enabled ? Math.max(0, settings.cap - occupied) : null, inviteRequired: settings.inviteRequired };
        }, { isolationLevel: 'RepeatableRead' }).then(value => { publicCache = { until: +now() + 30_000, value }; return value; }).finally(() => { publicPending = undefined; });
        await publicPending;
      }
      reply.header('cache-control', 'no-store');
      return publicCache!.value;
    } catch {
      return reply.code(503).header('cache-control', 'no-store').send({ error: 'ENTITLEMENTS_UNAVAILABLE', requestId: req.requestId });
    }
  });

  // Public feature requirements and the early-access window. No secrets, no per-user data.
  type PublicRequirements = { featureTiers: Record<string, string>; earlyAccess: { closesAt: string | null; accessDays: number | null } };
  let reqCache: { until: number; value: PublicRequirements } | undefined;
  const invalidatePublic = () => { publicCache = undefined; reqCache = undefined; };
  app.get('/v1/access/requirements', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    try {
      const at = now();
      if (!reqCache || reqCache.until <= +at) {
        const value = await db.$transaction(async tx => {
          const settings = await localSettings(tx);
          const access = await accessSettings(tx as typeof db);
          const featureTiers = Object.fromEntries(Object.entries(access.overrides).map(([key, value]) => [key, value.requiredTier ?? 'EARLY_ACCESS']));
          return { featureTiers, earlyAccess: { closesAt: settings.closesAt?.toISOString() ?? null, accessDays: settings.accessDays } };
        }, { isolationLevel: 'RepeatableRead' });
        reqCache = { until: +now() + 30_000, value };
      }
      reply.header('cache-control', 'no-store');
      return reqCache.value;
    } catch {
      return reply.code(503).header('cache-control', 'no-store').send({ error: 'ENTITLEMENTS_UNAVAILABLE', requestId: req.requestId });
    }
  });

  app.get('/v1/me/entitlements', opts(false, 60), handle(r => entitlementTrace(db, r.userId!, now())));
  app.post('/v1/me/early-access/join', opts(false, 5), handle(async r => { const result = await grantEarlyAccess(db, r.userId!, { tier: 'EARLY_ACCESS', validUntil: null, reason: 'Self join' }, null, now()); invalidatePublic(); return result; }));
  app.delete('/v1/me/early-access', opts(false, 5), handle(async r => {
    const grant = await db.accessGrant.findUnique({ where: { userId_source: { userId: r.userId!, source: 'EARLY_ACCESS' } } });
    if (grant) await revokeLocalGrant(db, r.userId!, grant.id, null, 'Self leave', now()); invalidatePublic(); return { ok: true };
  }));

  app.get('/v1/admin/entitlements/settings', opts(true), handle(async () => ({
    defaults: { 'entitlements.enforced': false, 'entitlements.shadow_log': true, 'early_access.enabled': false, 'early_access.seat_cap': 0, 'early_access.closes_at': null, 'early_access.access_days': null, 'entitlements.features': {} },
    items: await db.systemSetting.findMany({ where: { key: { in: Object.keys(SETTING_SCHEMAS) } } }),
  })));
  app.put('/v1/admin/entitlements/settings', opts(true), handle(async r => { const v = z.object({ settings: z.unknown(), reason: Reason, overridePrivyCheck: z.boolean().optional() }).strict().parse(r.body); await updateLocalSettings(db, r.userId!, v.settings, v.reason, { overridePrivyCheck: v.overridePrivyCheck }); invalidatePublic(); return { ok: true }; }));
  app.get('/v1/admin/users/:userId/entitlements', opts(true), handle(r => entitlementTrace(db, params(r).userId, now())));
  app.post('/v1/admin/users/:userId/entitlements/grants', opts(true, 10), handle(async r => {
    const v = z.object({ tier: z.literal('EARLY_ACCESS'), validUntil: z.string().datetime({ offset: true }).transform(s => new Date(s)), reason: Reason }).strict().parse(r.body);
    const result = await grantEarlyAccess(db, params(r).userId, v, r.userId!, now());
    invalidatePublic();
    return result;
  }));
  app.post('/v1/admin/users/:userId/entitlements/grants/:id/revoke', opts(true, 10), handle(async r => { const p = params(r); const v = z.object({ reason: Reason }).strict().parse(r.body); await revokeLocalGrant(db, p.userId, p.id!, r.userId!, v.reason, now()); invalidatePublic(); return { ok: true }; }));

  // Admin lookup: a user id, Privy user id or email to the user, so someone can be whitelisted without a database query.
  app.get('/v1/admin/users/lookup', opts(true), handle(async r => {
    const { q } = z.object({ q: z.string().trim().min(1).max(100) }).strict().parse(r.query);
    const users = await db.user.findMany({
      where: { OR: [{ id: q }, { privyUserId: q }, { email: { equals: q, mode: 'insensitive' } }] },
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, createdAt: true, isAdmin: true },
    });
    return { items: users.map(u => ({ id: u.id, email: u.email, createdAt: u.createdAt.toISOString(), isAdmin: u.isAdmin })) };
  }));
  // Who holds (or held) a local early-access grant, newest first.
  app.get('/v1/admin/early-access/grants', opts(true), handle(async () => {
    const rows = await db.accessGrant.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, userId: true, source: true, status: true, validUntil: true, reason: true, createdAt: true, user: { select: { email: true } } },
    });
    return { items: rows.map(g => ({ id: g.id, userId: g.userId, source: g.source, status: g.status, validUntil: g.validUntil?.toISOString() ?? null, reason: g.reason, createdAt: g.createdAt.toISOString(), email: g.user.email })) };
  }));
  app.get('/v1/admin/early-access/stats', opts(true), handle(async () => {
    const at = now(), settings = await localSettings(db);
    const active = { source: 'EARLY_ACCESS' as const, tier: 'EARLY_ACCESS' as const, status: 'ACTIVE' as const, OR: [{ validUntil: null }, { validUntil: { gt: at } }] };
    const occupied = (await db.accessGrant.findMany({ where: active, distinct: ['userId'], select: { userId: true } })).length;
    return { occupied, available: Math.max(0, settings.cap - occupied), cap: settings.cap, active: await db.accessGrant.count({ where: active }), expired: await db.accessGrant.count({ where: { source: 'EARLY_ACCESS', OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', validUntil: { lte: at } }] } }), revoked: await db.accessGrant.count({ where: { source: 'EARLY_ACCESS', status: 'REVOKED' } }) };
  }));
}
