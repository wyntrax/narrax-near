import { describe, expect, it } from 'vitest';
import { RateLimiter } from './limiter';
import { NearBlocksHolderSource } from './nearblocks';

type Reply = { status: number; body?: unknown };

function makeSource(replies: { count: Reply; holders?: Reply }, totalSupply: string | null = '1000') {
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const reply = url.includes('/holders/count') ? replies.count : replies.holders;
    if (!reply) return new Response('', { status: 404 });
    return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  const source = new NearBlocksHolderSource({
    fetch: fetchImpl as typeof fetch,
    limiter: new RateLimiter(0),
    totalSupply: async () => totalSupply,
  });
  return { source, calls };
}

describe('NearBlocks holder evidence', () => {
  it('computes an exact count and top-10 concentration from raw amounts', async () => {
    const { source } = makeSource({
      count: { status: 200, body: { holders: [{ count: '12' }] } },
      holders: {
        status: 200,
        body: {
          holders: [10, 100, 50, 5, 80, 20, 90, 1, 60, 40, 30, 70].map((amount, index) => ({
            account: `holder-${index}.near`, amount: String(amount),
          })),
        },
      },
    });
    await expect(source.getHolderEvidence('token.near')).resolves.toEqual({ holders: 12, top10Pct: 55 });
  });

  it('treats a zero count as not indexed and does not request holders', async () => {
    const { source, calls } = makeSource({ count: { status: 200, body: { holders: [{ count: '0' }] } } });
    await expect(source.getHolderEvidence('token.near')).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('returns null when total supply is unavailable', async () => {
    const { source } = makeSource({
      count: { status: 200, body: { holders: [{ count: '3' }] } },
      holders: { status: 200, body: { holders: [{ account: 'a.near', amount: '50' }, { account: 'b.near', amount: '30' }, { account: 'c.near', amount: '20' }] } },
    }, null);
    await expect(source.getHolderEvidence('token.near')).resolves.toBeNull();
  });

  it('returns null when the count is lower than the returned holders', async () => {
    const { source } = makeSource({
      count: { status: 200, body: { holders: [{ count: '2' }] } },
      holders: { status: 200, body: { holders: [{ account: 'a.near', amount: '50' }, { account: 'b.near', amount: '30' }, { account: 'c.near', amount: '20' }] } },
    });
    await expect(source.getHolderEvidence('token.near')).resolves.toBeNull();
  });

  it('returns null for a malformed holder amount instead of estimating', async () => {
    const { source } = makeSource({
      count: { status: 200, body: { holders: [{ count: '2' }] } },
      holders: { status: 200, body: { holders: [{ account: 'a.near', amount: '50' }, { account: 'b.near', amount: 'not-a-number' }] } },
    });
    await expect(source.getHolderEvidence('token.near')).resolves.toBeNull();
  });

  it('returns null on a 404', async () => {
    const { source } = makeSource({ count: { status: 404 } });
    await expect(source.getHolderEvidence('token.near')).resolves.toBeNull();
  });

  it('propagates a rate-limit error so the pipeline can stop the run', async () => {
    const { source } = makeSource({ count: { status: 429 } });
    await expect(source.getHolderEvidence('token.near')).rejects.toMatchObject({ kind: 'rate_limited' });
  });
});
