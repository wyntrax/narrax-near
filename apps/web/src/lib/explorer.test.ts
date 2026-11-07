import { describe, expect, it } from 'vitest';
import { accountExplorerUrl, isValidWalletAddress, transactionExplorerUrl } from './explorer';

describe('wallet explorer links', () => {
  it('uses NearBlocks for NEAR account ids and Solscan for legacy Solana addresses', () => {
    expect(accountExplorerUrl('alice.testnet')).toBe('https://testnet.nearblocks.io/address/alice.testnet');
    expect(accountExplorerUrl('So11111111111111111111111111111111111111112')).toBe('https://solscan.io/account/So11111111111111111111111111111111111111112');
    expect(transactionExplorerUrl('hash', 'alice.testnet')).toBe('https://testnet.nearblocks.io/txns/hash');
    expect(transactionExplorerUrl('hash', 'So11111111111111111111111111111111111111112')).toBe('https://solscan.io/tx/hash');
  });

  it('does not manufacture a link for an invalid identity', () => {
    expect(accountExplorerUrl('not an address')).toBeNull();
    expect(transactionExplorerUrl('hash', 'not an address')).toBeNull();
    expect(isValidWalletAddress('alice.testnet')).toBe(true);
    expect(isValidWalletAddress('So11111111111111111111111111111111111111112')).toBe(true);
    expect(isValidWalletAddress('not an address')).toBe(false);
  });
});
