import type { PrismaClient } from '@narra/database';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ACCESS_TIERS, FEATURE_TIERS, activeTier, resolveEntitlements, type AccessTier, type FeatureKey } from '@narra/shared';
import { SETTING_SCHEMAS } from './settings';
import { AccessError } from './common';
// The one admin decision (environment allowlist, else the database flag). Entitlements only read it; they never grant it.
import { decideIsAdmin } from '../adminAccess';

export async function accessSettings(db: PrismaClient) {
  const values: Record<string, unknown> = { 'entitlements.enforced': true, 'entitlements.shadow_log': true, 'early_access.enabled': false, 'entitlements.features': {} };
  for (const row of await db.systemSetting.findMany({ where: { key: { in: Object.keys(values) } } })) {
    const p = SETTING_SCHEMAS[row.key as keyof typeof SETTING_SCHEMAS].safeParse(row.value);
    if (!p.success) throw new AccessError('ENTITLEMENTS_UNAVAILABLE', 503);
    values[row.key] = p.data;
  }
  // Legacy rollout rows are accepted for compatibility but can never disable authorization.
  return {
    enforced: true, shadow: values['entitlements.shadow_log'] as boolean, enabled: values['early_access.enabled'] as boolean,
    overrides: values['entitlements.features'] as Record<string, { requiredTier?: AccessTier; min_entitlement_age_hours?: number }>,
  };
}

export async function entitlementTrace(db: PrismaClient, userId: string, now: Date) {
  // Repeatable read prevents combining grants from before a revoke with state from after it.
  return db.$transaction(async tx => {
    const settings = await accessSettings(tx as PrismaClient);
    const grants = await tx.accessGrant.findMany({ where: { userId } });
    // Identity and entitlements are read in one snapshot, so an admin decision cannot disagree with the features it grants.
    const adminRow = await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true, privyUserId: true, email: true } });
    const admin = decideIsAdmin(adminRow);
    const resolved = resolveEntitlements({ userId, grants, earlyAccessEnabled: settings.enabled, admin }, now);
    const features = Object.fromEntries(Object.entries(FEATURE_TIERS).map(([key, base]) => {
      const override = settings.overrides[key]; const requiredTier = activeTier(override?.requiredTier ?? base);
      const rank = ACCESS_TIERS.indexOf(requiredTier);
      // This build has no paid on-chain membership, so entitlement age is recorded but cannot delay a local grant.
      return [key, { requiredTier, min_entitlement_age_hours: override?.min_entitlement_age_hours ?? 0, allowed: admin || ACCESS_TIERS.indexOf(resolved.effectiveTier) >= rank }];
    })) as Record<FeatureKey, { requiredTier: AccessTier; min_entitlement_age_hours: number; allowed: boolean }>;
    return {
      ...resolved, features, rollout: { enforced: settings.enforced, shadow_log: settings.shadow },
      grants: grants.map(g => ({ ...g, eligible: resolved.sources.some(s => s.id === g.id && s.source === g.source), reasonCode: g.status !== 'ACTIVE' ? g.status : g.validUntil && g.validUntil <= now ? 'EXPIRED' : 'ACTIVE' })),
    };
  }, { isolationLevel: 'RepeatableRead' });
}

export async function featureDecision(db: PrismaClient, userId: string, key: FeatureKey, now: Date, log?: (entry: object) => void) {
  if (!Object.hasOwn(FEATURE_TIERS, key)) throw new AccessError('ENTITLEMENTS_UNAVAILABLE', 503);
  const trace = await entitlementTrace(db, userId, now), feature = trace.features[key];
  if (!feature.allowed && trace.rollout.shadow_log) log?.({ code: 'ENTITLEMENT_DENIAL', feature: key, enforced: trace.rollout.enforced });
  return { allowed: feature.allowed, requiredTier: feature.requiredTier, pageLimit: Math.max(1, trace.researchPageLimit) };
}

/** Mixed envelopes preserve own fields even if entitlement storage/resolution fails. */
export async function canReadFeature(db: PrismaClient, userId: string, key: FeatureKey, now: Date, log?: (entry: object) => void) {
  try { return (await featureDecision(db, userId, key, now, log)).allowed; } catch { return false; }
}

export function requireFeature(db: PrismaClient, key: FeatureKey, now = () => new Date()) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const decision = await featureDecision(db, req.userId!, key, now(), entry => req.log.info(entry, 'research access decision'));
      if (!decision.allowed) return reply.code(403).send({ error: 'FEATURE_LOCKED', requiredTier: decision.requiredTier, requestId: req.requestId });
      const q = req.query as Record<string, unknown>;
      if (q && ('limit' in q || ['research.narratives', 'research.tokens', 'research.screener', 'research.decision_analytics', 'research.smart_money'].includes(key))) {
        const limit = q.limit === undefined ? 25 : Number(q.limit);
        if (Number.isInteger(limit) && limit > 0 && limit <= 100) q.limit = Math.min(limit, decision.pageLimit);
      }
    } catch { return reply.code(503).send({ error: 'ENTITLEMENTS_UNAVAILABLE', requestId: req.requestId }); }
  };
}
