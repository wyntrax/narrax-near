import { z } from 'zod';
import { getJson, toNumber, type HttpOptions } from './http';
import { RateLimiter } from './limiter';
import { MarketDataError } from './types';

/** The free NearBlocks API is rate-limited; 2.5 s keeps two calls per token well under a burst. */
export const NEARBLOCKS_MIN_INTERVAL_MS = 2500;

const CountBody = z.object({
  holders: z.array(z.object({ count: z.union([z.string(), z.number()]) })).min(1),
});
const HoldersBody = z.object({
  holders: z.array(z.object({ account: z.string(), amount: z.string() })),
});

export interface HolderEvidence {
  holders: number;
  /** Percent of total supply held by the ten largest accounts. */
  top10Pct: number;
}

export interface HolderSource {
  readonly name: string;
  /** Null means the source cannot establish current holder evidence. It never returns a zero-filled guess. */
  getHolderEvidence(mint: string): Promise<HolderEvidence | null>;
}

export interface NearBlocksOptions extends HttpOptions {
  baseUrl?: string;
  /** Reads NEP-141 `ft_total_supply` as a raw integer string. */
  totalSupply: (mint: string) => Promise<string | null>;
}

/**
 * Holder count and top-10 concentration from the public NearBlocks API, used when GeckoTerminal
 * returns no holder data for a NEAR token. Counts are exact; concentration is computed from the
 * top holders and `ft_total_supply`.
 *
 * A count of zero is treated as "not indexed", not "zero holders", because NearBlocks returns
 * empty holder lists for tokens it has not indexed.
 */
export class NearBlocksHolderSource implements HolderSource {
  readonly name = 'nearblocks';
  private readonly baseUrl: string;
  private readonly limiter: RateLimiter;
  constructor(private readonly opts: NearBlocksOptions) {
    const base = (opts.baseUrl || 'https://api.nearblocks.io').replace(/\/$/, '');
    this.baseUrl = base === 'https://nearblocks.io' ? 'https://api.nearblocks.io' : base;
    this.limiter = opts.limiter ?? new RateLimiter(NEARBLOCKS_MIN_INTERVAL_MS);
  }

  private get http(): HttpOptions {
    return { ...this.opts, limiter: this.limiter, headers: { accept: 'application/json', ...this.opts.headers } };
  }

  async getHolderEvidence(mint: string): Promise<HolderEvidence | null> {
    const countRead = await getJson(`${this.baseUrl}/v1/fts/${encodeURIComponent(mint)}/holders/count`, this.http);
    if (countRead.status === 404) return null;
    const countParsed = CountBody.safeParse(countRead.body);
    if (!countParsed.success) throw new MarketDataError('shape', 'nearblocks holder count had an unexpected shape');
    const count = toNumber(countParsed.data.holders[0]?.count);
    if (count == null || !Number.isInteger(count) || count <= 0) return null;

    const holdersRead = await getJson(`${this.baseUrl}/v1/fts/${encodeURIComponent(mint)}/holders?per_page=100&page=1`, this.http);
    if (holdersRead.status === 404) return null;
    const holdersParsed = HoldersBody.safeParse(holdersRead.body);
    if (!holdersParsed.success) throw new MarketDataError('shape', 'nearblocks holders had an unexpected shape');
    const holders = holdersParsed.data.holders;
    // A count below the returned rows is inconsistent; do not build a metric from it.
    if (!holders.length || count < holders.length) return null;

    const amounts: bigint[] = [];
    for (const holder of holders) {
      if (!/^\d+$/.test(holder.amount)) return null;
      amounts.push(BigInt(holder.amount));
    }

    let totalSupply: string | null;
    try {
      totalSupply = await this.opts.totalSupply(mint);
    } catch {
      return null;
    }
    if (!totalSupply || !/^\d+$/.test(totalSupply)) return null;
    const total = BigInt(totalSupply);
    if (total <= 0n) return null;

    amounts.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    const top10 = amounts.slice(0, 10).reduce((sum, amount) => sum + amount, 0n);
    if (top10 <= 0n || top10 > total) return null;

    // Two decimal places, without floating-point rounding on the raw token amounts.
    return { holders: count, top10Pct: Number((top10 * 10_000n) / total) / 100 };
  }
}
