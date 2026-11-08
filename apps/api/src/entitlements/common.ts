import type { Prisma } from '@narra/database';
import { decideIsAdmin } from '../adminAccess';

export class AccessError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
export const lock = (tx: Prisma.TransactionClient, name: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`narra-entitlements:${name}`}, 0))`;
export const lockUser = (tx: Prisma.TransactionClient, userId: string) => lock(tx, `user:${userId}`);
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000, isolationLevel: 'ReadCommitted' as const };
export async function requireAdminActor(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { isAdmin: true, privyUserId: true, email: true } });
  if (!decideIsAdmin(actor)) throw new AccessError('FORBIDDEN', 403);
}
export const audit = (tx: Prisma.TransactionClient, userId: string | null, action: string, detail: Prisma.InputJsonValue) => tx.auditLog.create({ data: { userId, action, detail } });
