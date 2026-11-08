import { isNearAccountId } from '@narra/shared';

/**
 * Explorer links for NEAR identity data. NEAR accounts and transactions go to NearBlocks.
 * Unknown strings have no link.
 */
const NEAR_EXPLORER = process.env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet' ? 'https://nearblocks.io' : 'https://testnet.nearblocks.io';

export function accountExplorerUrl(address: string): string | null {
  if (isNearAccountId(address)) return `${NEAR_EXPLORER}/address/${encodeURIComponent(address)}`;
  return null;
}

export function transactionExplorerUrl(hash: string, address: string): string | null {
  if (isNearAccountId(address)) return `${NEAR_EXPLORER}/txns/${encodeURIComponent(hash)}`;
  return null;
}

/** GeckoTerminal's NEAR market is mainnet, so observed-wallet evidence always links to mainnet NearBlocks. */
const MAINNET_EXPLORER = 'https://nearblocks.io';
export function mainnetAccountExplorerUrl(address: string): string | null {
  if (isNearAccountId(address)) return `${MAINNET_EXPLORER}/address/${encodeURIComponent(address)}`;
  return null;
}
export function mainnetTransactionExplorerUrl(hash: string, address: string): string | null {
  if (isNearAccountId(address)) return `${MAINNET_EXPLORER}/txns/${encodeURIComponent(hash)}`;
  return null;
}

export const isValidWalletAddress = (address: string): boolean => isNearAccountId(address);
