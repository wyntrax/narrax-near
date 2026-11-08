/**
 * Chain routing for the NARRAX deployment.
 *
 * This build serves NEAR only. The helpers are kept pure so the Next.js middleware and the API
 * can share one decision when another chain is added later.
 */
export const CHAIN_IDS = ['near'] as const;
export type ChainId = (typeof CHAIN_IDS)[number];

export interface ChainDescriptor {
  id: ChainId;
  label: string;
  /** First DNS label reserved for this chain, e.g. `near.narrax.xyz`. */
  subdomain: ChainId;
  nativeSymbol: string;
  nativeDecimals: number;
}

export const CHAINS: Record<ChainId, ChainDescriptor> = {
  near: { id: 'near', label: 'NEAR', subdomain: 'near', nativeSymbol: 'NEAR', nativeDecimals: 24 },
};

/** Lowercase a Host header and drop the port, the trailing dot, and stray whitespace. */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** The chain named by the first DNS label, or null when the host is not a chain subdomain. */
export function chainFromSubdomain(host: string): ChainId | null {
  const label = normalizeHost(host).split('.')[0];
  return CHAIN_IDS.find((id) => id === label) ?? null;
}

/**
 * Resolve the chain for a request host.
 *
 * - `near.example.com` -> near
 * - `example.com` -> the first supported chain (the apex default)
 * - any unsupported subdomain -> the first supported chain
 */
export function resolveChainFromHost(host: string, supported: readonly ChainId[] = CHAIN_IDS): ChainId {
  if (supported.length === 0) throw new Error('resolveChainFromHost needs at least one supported chain');
  const named = chainFromSubdomain(host);
  if (named && supported.includes(named)) return named;
  return supported[0] as ChainId;
}

/** True when the request host explicitly names the chain (not merely falling back to the apex). */
export function isChainSubdomain(host: string, chain: ChainId): boolean {
  return chainFromSubdomain(host) === chain;
}
