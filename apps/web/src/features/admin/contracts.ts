import {z} from 'zod';
import {EarlyAccessDays} from '@narra/shared';

const DateTime = z.string().datetime({offset: true});
const Count = z.number().int().nonnegative();
export const DataHealthSchema = z.object({
  checkedAt: DateTime,
  issues: z.array(z.string()),
  queues: z.array(z.object({name: z.string(), state: z.enum(['OK','WARNING','ERROR','UNKNOWN','DISABLED']), counts: z.object({waiting: Count, active: Count, failed: Count, delayed: Count, consumers: Count.optional()}).nullable(), lastCompletedAt: DateTime.nullable(), lastFailedAt: DateTime.nullable(), lastRun: z.object({analyzed: Count.optional(), providerFailures: Count.optional(), tokensUsed: Count.optional(), skipped: z.string().optional(), rateLimited: z.boolean().optional()}).nullable()})),
  market: z.object({scanned: Count, total: Count, capped: z.boolean(), fresh: Count, stale: Count, unverified: Count, lastAt: DateTime.nullable(), enabled: z.boolean(), unknownNames: Count}),
  analysis: z.object({enabled: z.boolean(), providerConfigured: z.boolean().nullable(), fastModel: z.string(), reasoningModel: z.string(), usedToday: Count, budget: Count, recentCandidates: Count, recentBelowThreshold: Count, olderUnanalyzed: Count}),
  freshnessAgeSeconds: Count.nullable().optional(),
});
export type DataHealth = z.infer<typeof DataHealthSchema>;

/** Only what the shell needs from GET /v1/me: whether to show the Admin link. */
export const MeSchema = z.object({isAdmin: z.boolean().optional(), admin: z.object({configured: z.boolean(), privyUserId: z.string(), email: z.string().nullable()}).optional()});

export const SettingsSchema = z.object({items: z.array(z.object({key: z.string(), value: z.unknown()}))});
const Source = z.enum(['database','environment']);
export const RuntimeSettingsSchema = z.object({
  privyAppId: z.object({value: z.string(), source: Source}),
  privyVerificationKey: z.object({value: z.string(), source: Source}),
  corsOrigins: z.object({value: z.array(z.string()), source: Source, extra: z.array(z.string()), environment: z.array(z.string())}),
});
export type RuntimeSettings = z.infer<typeof RuntimeSettingsSchema>;
export const StatsSchema = z.object({occupied: z.number(), available: z.number(), cap: z.number(), active: z.number(), expired: z.number(), revoked: z.number()});
export type AdminStats = z.infer<typeof StatsSchema>;
export const LookupSchema = z.object({items: z.array(z.object({id: z.string(), email: z.string().nullable(), createdAt: DateTime, isAdmin: z.boolean()}))});
export const GrantListSchema = z.object({items: z.array(z.object({id: z.string(), userId: z.string(), source: z.enum(['EARLY_ACCESS', 'ADMIN']), status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED']), validUntil: DateTime.nullable(), reason: z.string().nullable(), createdAt: DateTime, email: z.string().nullable()}))});

export type AdminSettings = {enabled: boolean; cap: number; enforced: boolean; shadow: boolean};
export type AdminGrant = z.infer<typeof GrantListSchema>['items'][number];

/** Stored settings rows to form values. A setting that was never saved shows the API's default. */
export function toSettings(items: {key: string; value?: unknown}[]): AdminSettings {
  const get = (key: string) => items.find(item => item.key === key)?.value;
  return {
    enabled: get('early_access.enabled') === true,
    cap: typeof get('early_access.seat_cap') === 'number' ? get('early_access.seat_cap') as number : 0,
    enforced: get('entitlements.enforced') === true,
    shadow: get('entitlements.shadow_log') !== false,
  };
}

/** The body for PUT /v1/admin/entitlements/settings. */
export function toPayload(s: AdminSettings): Record<string, unknown> {
  return {'early_access.enabled': s.enabled, 'early_access.seat_cap': s.cap, 'entitlements.enforced': s.enforced, 'entitlements.shadow_log': s.shadow};
}

/** A grant the API still counts: ACTIVE and not past its expiry. */
export function effectiveStatus(grant: Pick<AdminGrant, 'status' | 'validUntil'>, now = Date.now()): 'ACTIVE' | 'EXPIRED' | 'REVOKED' {
  if (grant.status === 'ACTIVE' && grant.validUntil && Date.parse(grant.validUntil) <= now) return 'EXPIRED';
  return grant.status;
}

export const shortId = (value: string) => value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

/** Stored early-access window to form values. */
export type WindowForm = {closesAt: string; accessDays: string};
const pad = (n: number) => String(n).padStart(2, '0');
export function toLocalInput(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function toWindowForm(items: {key: string; value?: unknown}[]): WindowForm {
  const get = (key: string) => items.find(item => item.key === key)?.value;
  const closes = get('early_access.closes_at'), days = get('early_access.access_days');
  return {closesAt: toLocalInput(typeof closes === 'string' ? closes : null), accessDays: typeof days === 'number' ? String(days) : ''};
}
export type WindowParse = {ok: true; payload: Record<string, unknown>} | {ok: false; error: 'time' | 'days'};
/** Empty closing time and empty seat length clear those limits (null). */
export function parseWindowForm(form: WindowForm): WindowParse {
  let closes: string | null = null;
  if (form.closesAt) {
    const time = new Date(form.closesAt);
    if (!Number.isFinite(time.getTime())) return {ok: false, error: 'time'};
    closes = time.toISOString();
  }
  let days: number | null = null;
  if (form.accessDays.trim()) {
    const parsed = EarlyAccessDays.safeParse(/^\d{1,4}$/.test(form.accessDays.trim()) ? Number(form.accessDays.trim()) : NaN);
    if (!parsed.success) return {ok: false, error: 'days'};
    days = parsed.data;
  }
  return {ok: true, payload: {'early_access.closes_at': closes, 'early_access.access_days': days}};
}
