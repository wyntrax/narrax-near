import { describe, expect, it, vi } from 'vitest';
import { NearRpcError, type NearRpc } from '@narra/near';
import { createContractSafety } from './contractSafety';

const CONTRACT_CODE_HASH = 'DcKu2Xv8KAomrssGk3TBTJdDgjUFFD434B2T22yRd4ag';
const EMPTY = '11111111111111111111111111111111';

function rpc(overrides: {
  account?: () => Promise<{ code_hash: string }>;
  keys?: () => Promise<{ block_height: number; block_hash: string; keys: unknown[] }>;
} = {}) {
  return {
    viewAccount: vi.fn(overrides.account ?? (async () => ({ code_hash: CONTRACT_CODE_HASH }))),
    viewAccessKeyList: vi.fn(overrides.keys ?? (async () => ({ block_height: 1, block_hash: 'h', keys: [] }))),
  } as unknown as Pick<NearRpc, 'viewAccount' | 'viewAccessKeyList'>;
}

const fullKey = (id: string) => ({ public_key: id, access_key: { nonce: 1, permission: 'FullAccess' } });
const callKey = (id: string) => ({
  public_key: id,
  access_key: { nonce: 1, permission: { FunctionCall: { allowance: null, receiver_id: 'token.near', method_names: [] } } },
});

describe('contract safety', () => {
  it('counts full-access and function-call keys on a contract', async () => {
    const source = rpc({ keys: async () => ({ block_height: 1, block_hash: 'h', keys: [fullKey('a'), callKey('b'), callKey('c')] }) });
    await expect(createContractSafety(source).inspect('token.near')).resolves.toEqual({
      status: 'CONTRACT', fullAccessKeys: 1, functionCallKeys: 2,
    });
  });

  it('marks an account without code as NOT_CONTRACT and reads no keys', async () => {
    const source = rpc({ account: async () => ({ code_hash: EMPTY }) });
    await expect(createContractSafety(source).inspect('alice.near')).resolves.toEqual({
      status: 'NOT_CONTRACT', fullAccessKeys: null, functionCallKeys: null,
    });
    expect(source.viewAccessKeyList).not.toHaveBeenCalled();
  });

  it('marks a global contract (empty code hash, global_contract_hash set) as a contract', async () => {
    const source = rpc({ account: async () => ({ code_hash: EMPTY, global_contract_hash: '5qScjXG9uRG82Yrh36XZNZgVUYiqPtuC9ep5DvV42eGQ' }) });
    await expect(createContractSafety(source).inspect('token.near')).resolves.toMatchObject({ status: 'CONTRACT' });
    expect(source.viewAccessKeyList).toHaveBeenCalled();
  });

  it('marks a missing account as NOT_FOUND', async () => {
    const source = rpc({ account: async () => { throw new NearRpcError('account does not exist', -32000); } });
    await expect(createContractSafety(source).inspect('missing.near')).resolves.toEqual({
      status: 'NOT_FOUND', fullAccessKeys: null, functionCallKeys: null,
    });
  });

  it('reads the missing-account detail from the RPC error data', async () => {
    const source = rpc({
      account: async () => { throw new NearRpcError('Server error', -32000, 'account missing.near does not exist while viewing'); },
    });
    await expect(createContractSafety(source).inspect('missing.near')).resolves.toMatchObject({ status: 'NOT_FOUND' });
  });

  it('does not call an unrelated RPC error NOT_FOUND', async () => {
    const source = rpc({ account: async () => { throw new NearRpcError('Server error', -32000, { name: 'TIMEOUT_ERROR' }); } });
    await expect(createContractSafety(source).inspect('token.near')).resolves.toBeNull();
  });

  it('returns null, never a guess, when the RPC fails', async () => {
    const source = rpc({ account: async () => { throw new Error('network down'); } });
    await expect(createContractSafety(source).inspect('token.near')).resolves.toBeNull();
  });

  it('keeps the contract status when only the key list fails', async () => {
    const source = rpc({ keys: async () => { throw new Error('key list unavailable'); } });
    await expect(createContractSafety(source).inspect('token.near')).resolves.toEqual({
      status: 'CONTRACT', fullAccessKeys: null, functionCallKeys: null,
    });
  });

  it('caches for the TTL and refreshes after it', async () => {
    let now = 1_000;
    const source = rpc();
    const safety = createContractSafety(source, { now: () => now, ttlMs: 1_000 });
    await safety.inspect('token.near');
    await safety.inspect('token.near');
    expect(source.viewAccount).toHaveBeenCalledTimes(1);
    now += 1_001;
    await safety.inspect('token.near');
    expect(source.viewAccount).toHaveBeenCalledTimes(2);
  });

  it('retries a failed check sooner than a successful one', async () => {
    let now = 1_000;
    let fail = true;
    const source = rpc({ account: async () => {
      if (fail) throw new Error('network down');
      return { code_hash: CONTRACT_CODE_HASH };
    } });
    const safety = createContractSafety(source, { now: () => now, ttlMs: 60_000, errorTtlMs: 1_000 });
    await expect(safety.inspect('token.near')).resolves.toBeNull();
    fail = false;
    now += 1_001;
    await expect(safety.inspect('token.near')).resolves.toMatchObject({ status: 'CONTRACT' });
    expect(source.viewAccount).toHaveBeenCalledTimes(2);
  });

  it('verifies NEP-141 ft_metadata when callFunction is available', async () => {
    const source = {
      ...rpc(),
      callFunction: vi.fn(async () => ({
        value: { spec: 'ft-1.0.0', name: 'Token', symbol: 'TOK', decimals: 18 },
        logs: [],
        blockHeight: 1,
        blockHash: 'h',
      })),
    } as unknown as NearRpc;
    await expect(createContractSafety(source).inspect('token.near')).resolves.toEqual({
      status: 'CONTRACT', fullAccessKeys: 0, functionCallKeys: 0, nep141: true,
    });
  });

  it('marks deployed contracts without ft_metadata as non-NEP-141', async () => {
    const source = {
      ...rpc(),
      callFunction: vi.fn(async () => {
        throw new NearRpcError('Server error', -32000, {
          name: 'HANDLER_ERROR',
          cause: { name: 'CONTRACT_EXECUTION_ERROR', info: { message: 'MethodNotFound' } },
        });
      }),
    };
    await expect(createContractSafety(source).inspect('social.near')).resolves.toEqual({
      status: 'CONTRACT', fullAccessKeys: 0, functionCallKeys: 0, nep141: false,
    });
  });

  it('returns null nep141 instead of false when ft_metadata fails on RPC transport', async () => {
    const source = {
      ...rpc(),
      callFunction: vi.fn(async () => { throw new NearRpcError('timeout', 'TRANSPORT'); }),
    };
    await expect(createContractSafety(source).inspect('token.near')).resolves.toEqual({
      status: 'CONTRACT', fullAccessKeys: 0, functionCallKeys: 0, nep141: null,
    });
  });
});
