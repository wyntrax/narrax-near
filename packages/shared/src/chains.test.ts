import { describe, expect, it } from 'vitest';
import { chainFromSubdomain, isChainSubdomain, normalizeHost, resolveChainFromHost } from './chains';

describe('normalizeHost', () => {
  it('lowercases, strips the port and the trailing dot', () => {
    expect(normalizeHost(' NEAR.Narrax.xyz.:443 ')).toBe('near.narrax.xyz');
    expect(normalizeHost('localhost:4010')).toBe('localhost');
  });
});

describe('chainFromSubdomain', () => {
  it('recognises a chain label in the first position only', () => {
    expect(chainFromSubdomain('near.narrax.xyz')).toBe('near');
    expect(chainFromSubdomain('solana.narrax.xyz')).toBe('solana');
    expect(chainFromSubdomain('nearblocks.io')).toBeNull();
    expect(chainFromSubdomain('narrax.xyz')).toBeNull();
  });
});

describe('resolveChainFromHost', () => {
  it('uses the subdomain when the deployment supports it', () => {
    expect(resolveChainFromHost('near.narrax.xyz')).toBe('near');
    expect(resolveChainFromHost('solana.narrax.xyz')).toBe('solana');
    expect(resolveChainFromHost('near.localhost:4010')).toBe('near');
  });

  it('defaults the apex to Solana for the full multi-chain product', () => {
    expect(resolveChainFromHost('narrax.xyz')).toBe('solana');
    expect(resolveChainFromHost('www.narrax.xyz')).toBe('solana');
  });

  it('falls back to the only implemented chain in the NEAR build', () => {
    expect(resolveChainFromHost('narrax.xyz', ['near'])).toBe('near');
    expect(resolveChainFromHost('solana.narrax.xyz', ['near'])).toBe('near');
    expect(resolveChainFromHost('localhost:4010', ['near'])).toBe('near');
    expect(resolveChainFromHost('near.narrax.xyz', ['solana', 'near'])).toBe('near');
  });

  it('refuses an empty support list instead of guessing', () => {
    expect(() => resolveChainFromHost('near.narrax.xyz', [])).toThrow();
  });
});

describe('isChainSubdomain', () => {
  it('distinguishes an explicit subdomain from the apex fallback', () => {
    expect(isChainSubdomain('near.narrax.xyz', 'near')).toBe(true);
    expect(isChainSubdomain('narrax.xyz', 'near')).toBe(false);
  });
});
