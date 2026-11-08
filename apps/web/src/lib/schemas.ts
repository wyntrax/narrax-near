import {z} from 'zod';
import {ACCESS_TIERS, FEATURE_TIERS} from '@narra/shared';
export const Tier = z.enum(ACCESS_TIERS);
const DateTime = z.string().datetime({offset: true});
export const GrantSchema = z.object({id: z.string(), userId: z.string(), source: z.enum(['EARLY_ACCESS','ADMIN']), tier: z.literal('EARLY_ACCESS'), status: z.enum(['ACTIVE','EXPIRED','REVOKED']), validUntil: DateTime.nullable()});
const Feature = z.object({requiredTier: Tier, allowed: z.boolean(), min_entitlement_age_hours: z.number().nonnegative()});
export const EntitlementsSchema = z.object({
  effectiveTier: Tier, admin: z.boolean().optional(), sources: z.array(z.object({source: z.enum(['EARLY_ACCESS','ADMIN']), id: z.string(), tier: Tier, validUntil: DateTime.nullable()})),
  nextExpiry: DateTime.nullable(), researchPageLimit: z.number().int().nonnegative(),
  features: z.record(Feature).refine(v => Object.keys(FEATURE_TIERS).every(k => k in v)), rollout: z.object({enforced: z.boolean(), shadow_log: z.boolean()}),
  grants: z.array(GrantSchema.extend({eligible: z.boolean(), reasonCode: z.enum(['ACTIVE','EXPIRED','REVOKED'])})),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;
export const StatusSchema = z.object({enabled: z.boolean(), seatsLeft: z.number().int().nonnegative().nullable(), inviteRequired: z.boolean()}).strict();
export type PublicStatus = z.infer<typeof StatusSchema>;
/** GET /v1/access/requirements: the early-access window and feature overrides. */
export const RequirementsSchema = z.object({
  featureTiers: z.record(Tier).optional(),
  earlyAccess: z.object({closesAt: DateTime.nullable(), accessDays: z.number().int().positive().nullable()}),
});
export type Requirements = z.infer<typeof RequirementsSchema>;
export const OkSchema = z.object({ok: z.literal(true)});
export const ApiErrorSchema = z.object({error: z.string(), requestId: z.string().optional(), requiredTier: Tier.optional()});
