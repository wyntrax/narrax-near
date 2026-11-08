import { describe, expect, it } from 'vitest';
import { DexScreenerSource, GeckoTerminalSource, MarketDataError, NEAR_REFERENCE_CONTRACTS, RateLimiter, tokenRisk } from './index';

const TOKEN = 'token.near';
const OTHER = 'other.testnet';
const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const fast = { limiter: new RateLimiter(0) };
const pair = (over: Record<string, unknown> = {}) => ({
  chainId: 'near', dexId: 'ref-finance', pairAddress: 'pool.near',
  baseToken: { address: TOKEN, name: 'Zorb Token', symbol: 'ZORB' },
  quoteToken: { address: 'wrap.near', name: 'Wrapped NEAR', symbol: 'NEAR' },
  priceUsd: '0.0041', liquidity: { usd: 50_000 }, volume: { h24: 120_000 }, priceChange: { h1: 4.5 },
  marketCap: 4_120_000, fdv: 4_120_000, pairCreatedAt: 1_760_000_000_000,
  ...over,
});

describe('NEAR market data', () => {
  it('keeps the deepest NEAR pair and rejects another chain', async () => {
    const src = new DexScreenerSource({ ...fast, fetch: reply([pair({ pairAddress: 'thin', liquidity: { usd: 1000 } }), pair({ pairAddress: 'deep', liquidity: { usd: 90_000 } }), pair({ chainId: 'ethereum' })]) });
    const s = (await src.getSnapshots([TOKEN])).get(TOKEN)!;
    expect(s).toMatchObject({ pairAddress: 'deep', priceUsd: 0.0041, liquidityUsd: 90_000, volume24hUsd: 120_000, symbol: 'ZORB' });
  });
  it('uses the NEAR token endpoint and batches 30 addresses', async () => {
    const urls: string[] = [];
    const f = (async (u: string) => { urls.push(u); return new Response('[]'); }) as unknown as typeof fetch;
    await new DexScreenerSource({ ...fast, fetch: f }).getSnapshots(Array.from({ length: 65 }, (_, i) => `token${i}.near`));
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('/tokens/v1/near/');
  });
  it('drops a pair instead of filling a missing price or liquidity', async () => {
    for (const p of [pair({ priceUsd: null }), pair({ liquidity: undefined }), pair({ volume: undefined }), pair({ marketCap: undefined, fdv: undefined })]) {
      expect((await new DexScreenerSource({ ...fast, fetch: reply([p]) }).getSnapshots([TOKEN])).size).toBe(0);
    }
  });
  it('throws typed errors for rate limits, HTTP failures and unknown bodies', async () => {
    const kind = async (f: typeof fetch) => { try { await new DexScreenerSource({ ...fast, fetch: f }).getSnapshots([TOKEN]); return 'none'; } catch (e) { return (e as MarketDataError).kind; } };
    expect(await kind(reply({}, 429))).toBe('rate_limited');
    expect(await kind(reply({}, 500))).toBe('http');
    expect(await kind(reply({ weird: 1 }))).toBe('shape');
  });
  it('reads NEAR pool launches and excludes reference assets', async () => {
    const body = {
      data: [
        { attributes: { address: 'pool1.near', name: 'ZORB / NEAR', pool_created_at: '2026-10-12T12:00:00Z', reserve_in_usd: '20000' }, relationships: { base_token: { data: { id: `near_${TOKEN}` } } } },
        { attributes: { address: 'pool2.near', name: 'NEAR / USDC', pool_created_at: '2026-10-12T12:00:00Z', reserve_in_usd: '30000' }, relationships: { base_token: { data: { id: 'near_wrap.near' } } } },
      ],
      included: [
        { id: `near_${TOKEN}`, attributes: { address: TOKEN, name: 'Zorb', symbol: 'ZORB' } },
        { id: 'near_wrap.near', attributes: { address: 'wrap.near', name: 'Wrapped NEAR', symbol: 'NEAR' } },
      ],
    };
    const pools = await new GeckoTerminalSource({ ...fast, fetch: reply(body) }).getNewPools();
    expect(pools).toHaveLength(1);
    expect(pools[0]).toMatchObject({ mint: TOKEN, symbol: 'ZORB', poolAddress: 'pool1.near', liquidityUsd: 20000 });
    expect(NEAR_REFERENCE_CONTRACTS.has('wrap.near')).toBe(true);
  });
  it('parses recent pool trades and drops rows without a usable wallet or USD value', async () => {
    const urls: string[] = [];
    const body = {
      data: [
        { id: 'trade-1', attributes: {
          block_timestamp: '2026-11-08T20:30:34Z', tx_hash: 'tx-1', tx_from_address: 'alice.near',
          from_token_address: 'token.near', to_token_address: 'wrap.near', from_token_amount: '10.5', to_token_amount: '2',
          price_from_in_usd: '0.25', price_to_in_usd: '3.1', volume_in_usd: '2.625', is_anomalous: false,
        } },
        { id: 'trade-2', attributes: {
          block_timestamp: '2026-11-08T20:30:35Z', tx_hash: 'tx-2', tx_from_address: 'not an account',
          from_token_address: 'token.near', to_token_address: 'wrap.near', from_token_amount: '1', to_token_amount: '1',
          price_from_in_usd: '1', price_to_in_usd: '1', volume_in_usd: '1', is_anomalous: false,
        } },
        { id: 'trade-3', attributes: {
          block_timestamp: '2026-11-08T20:30:36Z', tx_hash: 'tx-3', tx_from_address: 'bob.near',
          from_token_address: 'token.near', to_token_address: 'wrap.near', from_token_amount: '1', to_token_amount: '1',
          price_from_in_usd: '1', price_to_in_usd: '1', volume_in_usd: null, is_anomalous: false,
        } },
      ],
    };
    const f = (async (u: string) => { urls.push(u); return new Response(JSON.stringify(body)); }) as unknown as typeof fetch;
    const trades = await new GeckoTerminalSource({ ...fast, fetch: f }).getRecentTrades('pool:near');
    expect(trades).toEqual([{
      id: 'trade-1', poolAddress: 'pool:near', txHash: 'tx-1', wallet: 'alice.near',
      fromToken: 'token.near', toToken: 'wrap.near', fromAmount: 10.5, toAmount: 2,
      fromPriceUsd: 0.25, toPriceUsd: 3.1, volumeUsd: 2.625, at: new Date('2026-11-08T20:30:34Z'), anomalous: false,
    }]);
    expect(urls[0]).toContain('/networks/near/pools/pool%3Anear/trades');
  });
  it('scores only known facts and never treats missing concentration as safe', () => {
    const risk = tokenRisk({ liquidityUsd: 10_000, holders: 20, top10Pct: null, pairAgeMinutes: 10 });
    expect(risk.flags).toEqual(expect.arrayContaining(['THIN_LIQUIDITY', 'FEW_HOLDERS', 'VERY_NEW', 'CONCENTRATION_UNKNOWN']));
    expect(risk.riskScore).toBeGreaterThan(0);
  });
});
