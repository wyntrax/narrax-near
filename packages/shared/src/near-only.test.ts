import { describe, expect, it } from 'vitest';
import { CHAINS, CHAIN_IDS, chainFromSubdomain, resolveChainFromHost } from './chains';
import { isImplicitNearAccount, isNearAccountId } from './near-address';
import { ACCESS_TIERS, earlyAccessAdmission, resolveEntitlements } from './entitlements';

describe('NEAR-only routing', () => {
  it('serves only NEAR and falls back to it', () => {
    expect(CHAIN_IDS).toEqual(['near']);
    expect(CHAINS.near).toMatchObject({ label: 'NEAR', nativeSymbol: 'NEAR', nativeDecimals: 24 });
    expect(chainFromSubdomain('near.example.com')).toBe('near');
    expect(resolveChainFromHost('anything.example.com')).toBe('near');
  });
});

describe('NEAR account ids', () => {
  it('accepts named and implicit accounts and rejects other strings', () => {
    expect(isNearAccountId('alice.testnet')).toBe(true);
    expect(isNearAccountId('wrap.near')).toBe(true);
    expect(isNearAccountId('a'.repeat(64))).toBe(true);
    expect(isImplicitNearAccount('a'.repeat(64))).toBe(true);
    expect(isNearAccountId('So11111111111111111111111111111111111111112')).toBe(false);
    expect(isNearAccountId('Alice.testnet')).toBe(false);
    expect(isNearAccountId('a..near')).toBe(false);
  });
});

describe('local access', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const grant = { id: 'g', userId: 'u', source: 'EARLY_ACCESS', tier: 'EARLY_ACCESS', status: 'ACTIVE', validUntil: null };
  it('has no hidden or deprecated tier', () => {
    expect(ACCESS_TIERS).toEqual(['NONE', 'EARLY_ACCESS', 'MEMBER', 'PRO']);
  });
  it('resolves an active grant and admin access without a wallet', () => {
    const user = resolveEntitlements({ userId: 'u', grants: [grant], earlyAccessEnabled: true }, now);
    expect(user.effectiveTier).toBe('EARLY_ACCESS');
    expect(user.features['research.tokens']!.allowed).toBe(true);
    expect(user.features['research.personal_radar']!.allowed).toBe(false);
    expect(resolveEntitlements({ userId: 'admin', grants: [], earlyAccessEnabled: false, admin: true }, now).effectiveTier).toBe('PRO');
  });
  it('ignores expired or revoked grants', () => {
    expect(resolveEntitlements({ userId: 'u', grants: [{ ...grant, validUntil: new Date('2026-11-08T11:00:00Z') }], earlyAccessEnabled: true }, now).effectiveTier).toBe('NONE');
    expect(resolveEntitlements({ userId: 'u', grants: [{ ...grant, status: 'REVOKED' }], earlyAccessEnabled: true }, now).effectiveTier).toBe('NONE');
  });
  it('does not require a wallet to admit an early-access seat', () => {
    expect(earlyAccessAdmission({ enabled: true, cap: 2, occupied: 1, alreadySeated: false, inviteRequired: false, now })).toBeNull();
    expect(earlyAccessAdmission({ enabled: true, cap: 1, occupied: 1, alreadySeated: false, inviteRequired: false, now })).toBe('EARLY_ACCESS_FULL');
  });
});
