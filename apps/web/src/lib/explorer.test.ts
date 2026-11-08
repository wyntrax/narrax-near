import { describe, expect, it } from 'vitest';
import { accountExplorerUrl, isValidWalletAddress, transactionExplorerUrl } from './explorer';

describe('NEAR explorer links', () => {
  it('uses NearBlocks for NEAR account ids and transactions', () => {
    expect(accountExplorerUrl('alice.testnet')).toBe('https://testnet.nearblocks.io/address/alice.testnet');
    expect(transactionExplorerUrl('hash', 'alice.testnet')).toBe('https://testnet.nearblocks.io/txns/hash');
  });
  it('does not manufacture a link for an invalid identity', () => {
    expect(accountExplorerUrl('not an address')).toBeNull();
    expect(transactionExplorerUrl('hash', 'not an address')).toBeNull();
    expect(isValidWalletAddress('alice.testnet')).toBe(true);
    expect(isValidWalletAddress('a'.repeat(64))).toBe(true);
    expect(isValidWalletAddress('So11111111111111111111111111111111111111112')).toBe(false);
  });
});
