import { describe, expect, it, vi } from 'vitest';
import { nearMetadataSource } from './tokenMetadata';

describe('NEAR token metadata', () => {
  it('reads NEP-141 metadata from the exact contract and sanitizes text', async () => {
    const callFunction = vi.fn(async (contract: string) => ({
      value: contract === 'token.near'
        ? { name: '<b>Zorb</b>', symbol: 'ZORB', decimals: 18 }
        : { name: 'Other', symbol: 'OTH', decimals: 24 },
      logs: [], blockHeight: 1, blockHash: 'h',
    }));
    const source = nearMetadataSource({ callFunction } as never);
    const result = await source.get(['token.near', 'other.testnet', 'not an account']);
    expect(callFunction).toHaveBeenCalledTimes(2);
    expect(result.get('token.near')).toEqual({ name: '<b>Zorb</b>', symbol: 'ZORB' });
    expect(result.has('not an account')).toBe(false);
  });
  it('treats a contract without ft_metadata as unresolved', async () => {
    const source = nearMetadataSource({ callFunction: vi.fn(async () => { throw new Error('Method not found'); }) } as never);
    expect((await source.get(['missing.near'])).size).toBe(0);
  });
});
