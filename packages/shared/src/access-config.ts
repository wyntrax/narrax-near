import { z } from 'zod';
import { ACCESS_TIERS, FEATURE_TIERS } from './entitlements';

export const FeatureOverrides = z.record(z.object({ requiredTier: z.enum(ACCESS_TIERS).optional(), min_entitlement_age_hours: z.number().finite().min(0).max(8760).optional() }).strict())
  .refine(v => Object.keys(v).every(k => Object.hasOwn(FEATURE_TIERS, k)));

/** End of the early-access window. Null means no end date. */
export const EarlyAccessClosesAt = z.string().datetime({ offset: true }).nullable();
/** How long a self-joined seat lasts. Null means it does not expire by itself. */
export const EarlyAccessDays = z.number().int().min(1).max(3650).nullable();

/** Who powers Narrax. Shown in the web app; the link is fixed here, never taken from user input. */
export const POWERED_BY = { name: 'Wyntrax', url: 'https://wyntrax.xyz' } as const;
