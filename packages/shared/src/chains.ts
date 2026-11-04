/**
 * Chain routing for the multi-chain NARRAX deployment.
 *
 * The apex domain serves the original chain (Solana). Each additional chain is
 * mounted on a subdomain, for example `near.narrax.xyz`. This module is pure so
 * both the Next.js middleware and the API can share one decision.
 *
 * The NEAR build of the repository ships only the NEAR adapter. Callers pass the
 * chains this deployment actually implements; an unsupported subdomain falls
 * back to the first supported chain instead of returning a chain we cannot serve.
 */
export const CHAIN_IDS = ['solana', 'near'] as const;
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
  solana: { id: 'solana', label: 'Solana', subdomain: 'solana', nativeSymbol: 'SOL', nativeDecimals: 9 },
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
 * - `solana.example.com` -> solana
 * - `example.com` -> the first supported chain (the apex default)
 * - an unsupported subdomain -> the first supported chain
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
