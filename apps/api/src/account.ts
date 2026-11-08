import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@narra/database';
import { describeAuthFailure, type AuthVerifier } from './auth';
import { rejectedTokenMetadata } from './auth-token';
import { adminAllowlist, adminAllowlistConfigured, decideIsAdmin } from './adminAccess';

declare module 'fastify' {
  interface FastifyRequest { userId?: string; /** Set only from a Privy-signed identity token, never from the request body. */ userEmail?: string | null }
}

export interface AccountDeps {
  verifier: AuthVerifier;
  db: PrismaClient;
  now?: () => Date;
  /** Enqueues private research refreshes; the worker rechecks entitlements before evaluating. */
  requestPersonalResearch?: (userId: string) => Promise<unknown>;
}

/**
 * Finds the user for a verified Privy id, creating it on first sight. Database trouble throws, so an outage is a 500 and
 * does not look like a logout. Shared by the HTTP pre-handler and the WebSocket gateway.
 *
 * `email` is only ever passed after a Privy identity token verified it (see `makeAuthenticate`); it is stored so the
 * env-configured admin allowlist can match on address. A caller with no verified email leaves the stored value alone.
 */
export async function resolveUserId(db: PrismaClient, privyUserId: string, email?: string | null): Promise<string> {
  const find = () => db.user.findUnique({ where: { privyUserId }, select: { id: true, email: true } });
  let user = await find();
  if (!user) {
    try {
      user = await db.user.create({ data: { privyUserId, ...(email ? { email } : {}) }, select: { id: true, email: true } });
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e; // two first requests raced; the other one created it
      user = await find();
    }
  }
  // Reconcile only on a real change, so a signed-in session does not write on every request.
  if (user && email && user.email !== email) await db.user.update({ where: { id: user.id }, data: { email } });
  return user!.id;
}

/**
 * Pre-handler that requires a signed-in admin. The ADMIN_* environment wins when it is set (fail closed: a leftover
 * database admin is ignored), and the database flag decides only when neither variable is configured.
 */
export function makeRequireAdmin(deps: Pick<AccountDeps, 'db' | 'verifier'>) {
  const authenticate = makeAuthenticate(deps);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const denied = await authenticate(req, reply);
    if (denied || reply.sent) return denied;
    const u = await deps.db.user.findUnique({ where: { id: req.userId! }, select: { isAdmin: true, privyUserId: true, email: true } });
    if (!decideIsAdmin(u)) return reply.code(403).send({ error: 'FORBIDDEN' });
  };
}

/** Pre-handler that verifies the bearer token and resolves (or creates) the user. Sets req.userId. */
export function makeAuthenticate(deps: Pick<AccountDeps, 'verifier' | 'db'>) {
  const { db, verifier } = deps;
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    let privyUserId: string;
    try {
      ({ privyUserId } = await verifier.verify(token));
    } catch (e) {
      // Only unverified routing metadata goes to the log, never the bearer token or private claims.
      req.log.warn({ reason: describeAuthFailure(e), token: rejectedTokenMetadata(token) }, 'access token rejected');
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    // The identity token is optional. When present it must be signed by Privy and belong to the same user, and it is the
    // only thing that can vouch for an email; a bad or mismatched one is ignored rather than failing the sign-in.
    const identityToken = req.headers['x-privy-identity-token'];
    let email: string | null = null;
    if (verifier.verifyIdentity && typeof identityToken === 'string' && identityToken) {
      try {
        const identity = await verifier.verifyIdentity(identityToken);
        if (identity.privyUserId === privyUserId) email = identity.email;
      } catch { /* no verified email available this request */ }
    }
    req.userEmail = email;
    req.userId = await resolveUserId(db, privyUserId, email);
  };
}

export function registerAccountRoutes(app: FastifyInstance, deps: AccountDeps): void {
  const { db } = deps;
  const authenticate = makeAuthenticate(deps);
  const routeOpts = { preHandler: authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  app.get('/v1/me', routeOpts, async (req) => {
    const user = await db.user.findUniqueOrThrow({ where: { id: req.userId! } });
    // Admin comes from the ADMIN_* environment when it is set; `admin` reports the caller's own identifiers so the
    // operator can copy the right value into the environment without hunting for it.
    const list = adminAllowlist();
    return {
      id: user.id, isAdmin: decideIsAdmin(user),
      admin: { configured: adminAllowlistConfigured(list), privyUserId: user.privyUserId, email: user.email },
    };
  });

  app.post('/v1/me/audit', routeOpts, async (req) => {
    const body = (req.body ?? {}) as { action?: unknown; detail?: unknown };
    const action = typeof body.action === 'string' && /^[a-z_.]{1,60}$/.test(body.action) ? body.action : 'client.event';
    await db.auditLog.create({ data: { userId: req.userId!, action, detail: (body.detail ?? null) as Prisma.InputJsonValue } });
    return { ok: true };
  });
}
