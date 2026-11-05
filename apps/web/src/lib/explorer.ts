import { isNearAccountId, isSolanaAddress } from '@narra/shared';

/**
 * Explorer links for the mixed identity data this build may still hold. NEAR accounts go to
 * NearBlocks; legacy Solana records go to Solscan. Unknown strings have no link.
 */
const NEAR_EXPLORER = process.env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';

export function accountExplorerUrl(address: string): string | null {
  if (isNearAccountId(address)) return `${NEAR_EXPLORER}/address/${encodeURIComponent(address)}`;
  if (isSolanaAddress(address)) return `https://solscan.io/account/${encodeURIComponent(address)}`;
  return null;
}

export function transactionExplorerUrl(hash: string, address: string): string | null {
  if (isNearAccountId(address)) return `${NEAR_EXPLORER}/txns/${encodeURIComponent(hash)}`;
  if (isSolanaAddress(address)) return `https://solscan.io/tx/${encodeURIComponent(hash)}`;
  return null;
}

export const isValidWalletAddress = (address: string): boolean => isNearAccountId(address) || isSolanaAddress(address);
