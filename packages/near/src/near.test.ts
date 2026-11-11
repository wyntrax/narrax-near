import { describe, expect, it } from 'vitest';
import { isImplicitNearAccount, isNearAccountId } from './account';
import { defaultNearRpcUrl, parseNearNetwork } from './network';
import { nearAccountUrl, nearTokenUrl, nearTransactionUrl } from './explorer';
import { formatTokenAmount, parseFtBalance, parseFtMetadata } from './nep141';
import { NearRpc, NearRpcError, decodeCallResult } from './rpc';
import { nearConfigFromEnv } from './config';

describe('isNearAccountId', () => {
  it('accepts named and implicit accounts', () => {
    for (const id of ['alice.near', 'sub.alice.near', 'a-b.near', 'a_b.near', '1234.near', '1'.repeat(64)]) {
      expect(isNearAccountId(id), id).toBe(true);
    }
    expect(isNearAccountId('a'.repeat(64))).toBe(true);
    expect(isNearAccountId('0123456789abcdef'.repeat(4))).toBe(true);
  });

  it('rejects uppercase, bad separators and wrong lengths', () => {
    for (const id of ['Alice.near', 'a', 'a..b', '.abc', 'abc.', 'a--b', 'a__b', 'a'.repeat(65), 'a b', '']) {
      expect(isNearAccountId(id), id).toBe(false);
    }
  });

  it('rejects non-strings', () => {
    expect(isNearAccountId(undefined)).toBe(false);
    expect(isNearAccountId(null)).toBe(false);
    expect(isNearAccountId(42)).toBe(false);
  });
});

describe('isImplicitNearAccount', () => {
  it('requires exactly 64 lowercase hex characters', () => {
    expect(isImplicitNearAccount('0123456789abcdef'.repeat(4))).toBe(true);
    expect(isImplicitNearAccount('0123456789ABCDEF'.repeat(4))).toBe(false);
    expect(isImplicitNearAccount('alice.near')).toBe(false);
  });
});

describe('network', () => {
  it('defaults to testnet and requires an explicit mainnet', () => {
    expect(parseNearNetwork(undefined)).toBe('testnet');
    expect(parseNearNetwork(' MAINNET ')).toBe('mainnet');
    expect(parseNearNetwork('mainet')).toBe('testnet');
  });

  it('has a matching default RPC', () => {
    expect(defaultNearRpcUrl('testnet')).toBe('https://rpc.testnet.near.org');
    expect(defaultNearRpcUrl('mainnet')).toBe('https://rpc.mainnet.near.org');
  });
});

describe('explorer links', () => {
  it('uses NearBlocks on the matching network', () => {
    expect(nearAccountUrl('testnet', 'alice.testnet')).toBe('https://testnet.nearblocks.io/address/alice.testnet');
    expect(nearTransactionUrl('mainnet', 'abc')).toBe('https://nearblocks.io/txns/abc');
    expect(nearTokenUrl('mainnet', 'wrap.near')).toBe('https://nearblocks.io/token/wrap.near');
  });

  it('encodes user input', () => {
    expect(nearAccountUrl('mainnet', 'a/b')).toContain('a%2Fb');
  });
});

describe('parseFtMetadata', () => {
  it('accepts valid NEP-141 metadata', () => {
    expect(parseFtMetadata({ name: 'Wrapped NEAR', symbol: 'wNEAR', decimals: 24, spec: 'ft-1.0.0' })).toEqual({
      name: 'Wrapped NEAR',
      symbol: 'wNEAR',
      decimals: 24,
      spec: 'ft-1.0.0',
    });
  });

  it('fails closed on missing or impossible fields', () => {
    for (const value of [null, {}, { name: 'X' }, { name: 'X', symbol: 'Y', decimals: '6' }, { name: 'X', symbol: 'Y', decimals: 1.5 }, { name: 'X', symbol: 'Y', decimals: 39 }]) {
      expect(() => parseFtMetadata(value), JSON.stringify(value)).toThrow(NearRpcError);
    }
  });
});

describe('parseFtBalance', () => {
  it('parses decimal strings without floating point', () => {
    expect(parseFtBalance('0')).toBe(0n);
    expect(parseFtBalance('12345678901234567890')).toBe(12_345_678_901_234_567_890n);
    expect(parseFtBalance('007')).toBe(7n);
  });

  it('rejects anything else', () => {
    for (const value of ['', '-1', '1.5', '1e6', 5, null]) expect(() => parseFtBalance(value)).toThrow(NearRpcError);
  });
});

describe('formatTokenAmount', () => {
  it('trims trailing zeros and keeps full precision', () => {
    expect(formatTokenAmount(1_000_000n, 6)).toBe('1');
    expect(formatTokenAmount(1_234_567n, 6)).toBe('1.234567');
    expect(formatTokenAmount(1n, 24)).toBe('0.000000000000000000000001');
    expect(formatTokenAmount(0n, 24)).toBe('0');
    expect(formatTokenAmount(-1_500_000n, 6)).toBe('-1.5');
    expect(formatTokenAmount(42n, 0)).toBe('42');
  });

  it('refuses invalid decimals', () => {
    for (const decimals of [-1, 1.5, 39]) expect(() => formatTokenAmount(1n, decimals)).toThrow(RangeError);
  });
});

describe('decodeCallResult', () => {
  it('decodes JSON bytes', () => {
    expect(decodeCallResult([...Buffer.from('{"ok":true}')])).toEqual({ ok: true });
    expect(decodeCallResult([...Buffer.from('"1000"')])).toBe('1000');
  });

  it('throws on malformed bytes or JSON', () => {
    for (const value of [null, 'abc', [1, 2, 300], [...Buffer.from('not json')]]) expect(() => decodeCallResult(value)).toThrow(NearRpcError);
  });
});

function fakeFetch(payload: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('nearConfigFromEnv', () => {
  it('defaults to testnet and the public RPC', () => {
    expect(nearConfigFromEnv({})).toEqual({
      network: 'testnet',
      rpcUrl: 'https://rpc.testnet.near.org',
      explorerBase: 'https://testnet.nearblocks.io',
    });
  });

  it('honours explicit values', () => {
    expect(nearConfigFromEnv({ NEAR_NETWORK: 'mainnet', NEAR_RPC_URL: 'https://rpc.example', NEAR_EXPLORER_URL: 'https://explorer.example' })).toEqual({
      network: 'mainnet',
      rpcUrl: 'https://rpc.example',
      explorerBase: 'https://explorer.example',
    });
  });

  it('rejects a malformed RPC URL instead of silently falling back', () => {
    expect(() => nearConfigFromEnv({ NEAR_RPC_URL: 'ftp://nope' })).toThrow('NEAR_RPC_URL');
    expect(() => nearConfigFromEnv({ NEAR_EXPLORER_URL: 'not-a-url' })).toThrow('NEAR_EXPLORER_URL');
  });
});

describe('NearRpc', () => {
  it('maps the latest final block and sends a JSON-RPC envelope', async () => {
    const { fetchImpl, calls } = fakeFetch({ jsonrpc: '2.0', id: 'narrax', result: { header: { height: 123, hash: 'abc', timestamp: 99 } } });
    const rpc = new NearRpc({ url: 'https://rpc.testnet.near.org', fetchImpl });
    await expect(rpc.latestBlock()).resolves.toEqual({ height: 123, hash: 'abc', timestamp: 99 });
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body).toEqual({ jsonrpc: '2.0', id: 'narrax', method: 'block', params: { finality: 'final' } });
    expect(calls[0]!.url).toBe('https://rpc.testnet.near.org');
  });

  it('surfaces a JSON-RPC error with its code', async () => {
    const { fetchImpl } = fakeFetch({ jsonrpc: '2.0', id: 'narrax', error: { code: -32000, message: 'Server error', data: { name: 'UNKNOWN_ACCOUNT' } } });
    const rpc = new NearRpc({ url: 'https://rpc.testnet.near.org', fetchImpl });
    await expect(rpc.viewAccount('missing.testnet')).rejects.toMatchObject({ name: 'NearRpcError', code: -32000, message: 'Server error' });
  });

  it('rejects HTTP errors and malformed envelopes', async () => {
    await expect(new NearRpc({ url: 'https://rpc.testnet.near.org', fetchImpl: fakeFetch({}, 503).fetchImpl }).latestBlock()).rejects.toThrow('HTTP 503');
    await expect(new NearRpc({ url: 'https://rpc.testnet.near.org', fetchImpl: fakeFetch({ jsonrpc: '2.0' }).fetchImpl }).latestBlock()).rejects.toThrow('no result');
  });

  it('distinguishes an externally owned account from a deployed contract', async () => {
    const empty = fakeFetch({ jsonrpc: '2.0', result: { account_id: 'alice.near', amount: '0', locked: '0', code_hash: '11111111111111111111111111111111', storage_usage: 0, block_height: 1, block_hash: 'h' } });
    const contract = fakeFetch({ jsonrpc: '2.0', result: { account_id: 'router.near', amount: '0', locked: '0', code_hash: 'DcKu2Xv8KAomrssGk3TBTJdDgjUFFD434B2T22yRd4ag', storage_usage: 0, block_height: 1, block_hash: 'h' } });
    const globalContract = fakeFetch({ jsonrpc: '2.0', result: { account_id: 'token.near', amount: '0', locked: '0', code_hash: '11111111111111111111111111111111', global_contract_hash: '5qScjXG9uRG82Yrh36XZNZgVUYiqPtuC9ep5DvV42eGQ', storage_usage: 0, block_height: 1, block_hash: 'h' } });
    await expect(new NearRpc({ url: 'https://rpc.mainnet.near.org', fetchImpl: empty.fetchImpl }).isContractAccount('alice.near')).resolves.toBe(false);
    await expect(new NearRpc({ url: 'https://rpc.mainnet.near.org', fetchImpl: contract.fetchImpl }).isContractAccount('router.near')).resolves.toBe(true);
    await expect(new NearRpc({ url: 'https://rpc.mainnet.near.org', fetchImpl: globalContract.fetchImpl }).isContractAccount('token.near')).resolves.toBe(true);
  });

  it('encodes view-call arguments and decodes the JSON result', async () => {
    const result = [...Buffer.from(JSON.stringify({ name: 'Token', symbol: 'TKN', decimals: 6 }))];
    const { fetchImpl, calls } = fakeFetch({ jsonrpc: '2.0', result: { result, logs: ['log'], block_height: 5, block_hash: 'h' } });
    const rpc = new NearRpc({ url: 'https://rpc.testnet.near.org', fetchImpl });
    const call = await rpc.callFunction('token.testnet', 'ft_balance_of', { account_id: 'alice.testnet' });
    expect(call).toEqual({ value: { name: 'Token', symbol: 'TKN', decimals: 6 }, logs: ['log'], blockHeight: 5, blockHash: 'h' });
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body.params).toMatchObject({ request_type: 'call_function', account_id: 'token.testnet', method_name: 'ft_balance_of' });
    expect(body.params.args_base64).toBe(Buffer.from('{"account_id":"alice.testnet"}').toString('base64'));
  });

  it('reads the access key list for an account', async () => {
    const { fetchImpl, calls } = fakeFetch({ jsonrpc: '2.0', result: {
      block_height: 7, block_hash: 'h',
      keys: [
        { public_key: 'ed25519:aaa', access_key: { nonce: 1, permission: 'FullAccess' } },
        { public_key: 'ed25519:bbb', access_key: { nonce: 2, permission: { FunctionCall: { allowance: null, receiver_id: 'token.near', method_names: ['ft_transfer'] } } } },
      ],
    } });
    const rpc = new NearRpc({ url: 'https://rpc.mainnet.near.org', fetchImpl });
    const list = await rpc.viewAccessKeyList('token.near');
    expect(list.keys).toHaveLength(2);
    expect(list.keys[1]!.access_key.permission).toMatchObject({ FunctionCall: { receiver_id: 'token.near' } });
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body).toEqual({ jsonrpc: '2.0', id: 'narrax', method: 'query', params: { request_type: 'view_access_key_list', finality: 'final', account_id: 'token.near' } });
  });
});
