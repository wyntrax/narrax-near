import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@narra/database';
import { sanitizeUntrusted } from '@narra/shared';
import { makeRequireAdmin } from './admin';
import type { AccountDeps } from './account';
import { IdCursor, Limit, decodeCursor, encodeCursor } from './paging';

const Reason = z.string().min(1).max(1000);
const cleanReason = (s: string) => sanitizeUntrusted(s, 300);
const Mint = z.string().min(2).max(64);
const AuditCursor = z.tuple([z.string().datetime(), IdCursor]);
const ListCursor = z.tuple([IdCursor]);

/**
 * Admin controls that change research behaviour, all audited with who, what changed (before and after) and why:
 * the token blacklist and the audit log. Nothing here can trade.
 */
export function registerAdminOpsRoutes(app: FastifyInstance, deps: Pick<AccountDeps, 'db' | 'verifier' | 'now'>): void {
  const db: PrismaClient = deps.db;
  const now = deps.now ?? (() => new Date());
  const opts = { preHandler: makeRequireAdmin(deps), config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
  const bad = (reply: { code(n: number): { send(b: unknown): unknown } }, extra: Record<string, unknown> = {}) => reply.code(400).send({ error: 'INVALID_INPUT', ...extra });
  const json = (v: unknown) => v as Prisma.InputJsonValue;

  // ---------- token blacklist ----------
  app.get('/v1/admin/blacklist', opts, async (req, reply) => {
    const q = z.object({ limit: Limit, cursor: z.string().max(300).optional() }).safeParse(req.query);
    if (!q.success) return bad(reply);
    let after: string | null = null;
    if (q.data.cursor) { const c = decodeCursor(q.data.cursor, ListCursor); if (!c) return bad(reply); after = c[0]; }
    const rows = await db.token.findMany({ where: { blacklisted: true, ...(after ? { id: { lt: after } } : {}) }, orderBy: { id: 'desc' }, take: q.data.limit + 1, select: { id: true, mint: true, symbol: true, blacklistReason: true, blacklistedAt: true, blacklistedBy: true } });
    const page = rows.slice(0, q.data.limit), last = page[page.length - 1];
    return {
      items: page.map((t) => ({ mint: t.mint, symbol: t.symbol /* untrusted text: render as plain text */, reason: t.blacklistReason, blacklistedAt: t.blacklistedAt, blacklistedBy: t.blacklistedBy })),
      nextCursor: rows.length > q.data.limit && last ? encodeCursor([last.id]) : null,
    };
  });

  app.put('/v1/admin/tokens/:mint/blacklist', opts, async (req, reply) => {
    const p = z.object({ mint: Mint }).safeParse(req.params);
    const body = z.object({ blacklisted: z.boolean(), reason: Reason }).strict().safeParse(req.body);
    if (!p.success || !body.success) return bad(reply);
    const reason = cleanReason(body.data.reason);
    if (!reason) return bad(reply);
    const token = await db.token.findUnique({ where: { mint: p.data.mint }, select: { id: true, mint: true, symbol: true, blacklisted: true } });
    if (!token) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (token.blacklisted === body.data.blacklisted) return { mint: token.mint, symbol: token.symbol, blacklisted: token.blacklisted, changed: false };
    const at = now();
    await db.$transaction([
      db.token.update({ where: { id: token.id }, data: body.data.blacklisted ? { blacklisted: true, blacklistReason: reason, blacklistedAt: at, blacklistedBy: req.userId! } : { blacklisted: false, blacklistReason: null, blacklistedAt: null, blacklistedBy: null } }),
      db.auditLog.create({ data: { userId: req.userId!, action: body.data.blacklisted ? 'token.blacklisted' : 'token.unblacklisted', detail: json({ mint: token.mint, reason }) } }),
    ]);
    return { mint: token.mint, symbol: token.symbol, blacklisted: body.data.blacklisted, changed: true };
  });

  // ---------- audit log ----------
  app.get('/v1/admin/audit', opts, async (req, reply) => {
    const q = z.object({ limit: Limit, cursor: z.string().max(300).optional(), action: z.string().regex(/^[a-z_.]{1,60}$/).optional(), userId: IdCursor.optional() }).safeParse(req.query);
    if (!q.success) return bad(reply);
    let cur: z.infer<typeof AuditCursor> | null = null;
    if (q.data.cursor) { cur = decodeCursor(q.data.cursor, AuditCursor); if (!cur) return bad(reply); }
    const rows = await db.auditLog.findMany({
      where: { ...(q.data.action ? { action: q.data.action } : {}), ...(q.data.userId ? { userId: q.data.userId } : {}), ...(cur ? { OR: [{ createdAt: { lt: new Date(cur[0]) } }, { createdAt: new Date(cur[0]), id: { lt: cur[1] } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.data.limit + 1,
    });
    const page = rows.slice(0, q.data.limit), last = page[page.length - 1];
    return { items: page.map((r) => ({ id: r.id, at: r.createdAt, userId: r.userId, action: r.action, detail: r.detail })), nextCursor: rows.length > q.data.limit && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null };
  });
}
