/** NearBlocks links. Kept in one place so the UI never hard-codes an explorer host. */
import type { NearNetwork } from './network';

export function nearExplorerBase(network: NearNetwork): string {
  return network === 'testnet' ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io';
}

export function nearAccountUrl(network: NearNetwork, accountId: string): string {
  return `${nearExplorerBase(network)}/address/${encodeURIComponent(accountId)}`;
}

export function nearTransactionUrl(network: NearNetwork, hash: string): string {
  return `${nearExplorerBase(network)}/txns/${encodeURIComponent(hash)}`;
}

export function nearTokenUrl(network: NearNetwork, contractId: string): string {
  return `${nearExplorerBase(network)}/token/${encodeURIComponent(contractId)}`;
}
