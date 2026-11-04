import { resolveChainFromHost, type ChainId } from '@narra/shared';

/**
 * Chains this deployment implements. The NEAR build serves only NEAR; the production
 * multi-chain deployment adds 'solana' here and keeps the apex domain on Solana.
 */
export const SUPPORTED_CHAINS = ['near'] as const satisfies readonly ChainId[];
export const DEFAULT_CHAIN: ChainId = SUPPORTED_CHAINS[0];

/** Host -> chain. Unknown hosts and unsupported subdomains fall back to the chain we actually serve. */
export function chainForHost(host: string | null | undefined): ChainId {
  return resolveChainFromHost(host ?? '', SUPPORTED_CHAINS);
}
