import { createPrisma } from '@narra/database';
import { NearRpc, nearConfigFromEnv } from '@narra/near';
import { DexScreenerSource, GeckoTerminalSource, NearBlocksHolderSource, RateLimiter } from '@narra/market-data';
import { refreshMarketData } from '../workers/pipeline/src/marketData';
import { resolveTokens } from '../workers/pipeline/src/tokenResolution';

/**
 * Refreshes the existing demo rows from the same public sources as the research worker.
 *
 *   npm run demo:refresh
 *
 * It never shifts timestamps and never invents a value: every row it writes is a real observation
 * made now. Without this step a freshly seeded demo ages out of the gate's freshness window and the
 * correct verdict is UNKNOWN. It refreshes existing tokens only; it does not discover new ones.
 */

const EXAMPLE_MINT = 'nearly-993927.nearlytrade.near';
const METRIC_FRESH_MS = 15 * 60_000;
const EVIDENCE_FRESH_MS = 60 * 60_000;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the demo refresh');
  const db = createPrisma();
  try {
    const near = nearConfigFromEnv();
    // The demo seed is mainnet research data. Keep the holder fallback on mainnet even when the chain
    // status probe is configured for testnet; an explicit DEMO_NEAR_RPC_URL wins.
    const rpcUrl = process.env.DEMO_NEAR_RPC_URL
      || (near.network === 'mainnet' ? near.rpcUrl : 'https://free.rpc.fastnear.com');
    if (near.network !== 'mainnet' && !process.env.DEMO_NEAR_RPC_URL) {
      console.log(`NEAR_NETWORK=${near.network}; demo data is mainnet, using ${rpcUrl} for the refresh`);
    }
    const rpc = new NearRpc({ url: rpcUrl, timeoutMs: 15_000 });
    const gecko = new GeckoTerminalSource({
      baseUrl: process.env.GECKOTERMINAL_BASE_URL,
      limiter: new RateLimiter(3500),
    });
    const holders = new NearBlocksHolderSource({
      baseUrl: process.env.NEARBLOCKS_BASE_URL,
      limiter: new RateLimiter(5500),
      totalSupply: async (mint) => {
        const result = await rpc.callFunction<unknown>(mint, 'ft_total_supply');
        return typeof result.value === 'string' ? result.value : null;
      },
    });
    const existingTokens = await db.token.findMany({
      where: { blacklisted: false },
      select: { mint: true, symbol: true, name: true, createdOnChainAt: true },
    });

    const started = Date.now();
    const now = new Date();
    const summary = await refreshMarketData(db, {
      metadata: null,
      quotes: new DexScreenerSource({ baseUrl: process.env.DEXSCREENER_BASE_URL }),
      info: gecko,
      holders,
      launches: {
        name: 'seeded-catalog',
        getNewPools: async () =>
          existingTokens.map((t) => ({
            mint: t.mint,
            symbol: t.symbol,
            name: t.name,
            poolAddress: t.mint,
            createdAt: t.createdOnChainAt ?? now,
            liquidityUsd: 25_000,
          })),
      },
    }, now, { maxTokens: 60, maxInfoCalls: 40 });
    const resolution = await resolveTokens(db, new Date());
    console.log(JSON.stringify({ ms: Date.now() - started, summary, resolution }, null, 2));

    const token = await db.token.findUnique({
      where: { mint: EXAMPLE_MINT },
      select: {
        symbol: true,
        metrics: { orderBy: { at: 'desc' }, take: 1, select: { at: true, liquidityUsd: true } },
        holders: { orderBy: { at: 'desc' }, take: 1, select: { at: true, holders: true, top10Pct: true } },
        risk: { orderBy: { at: 'desc' }, take: 1, select: { at: true, riskScore: true, flags: true } },
      },
    });
    const newestEvidence = [token?.holders[0]?.at, token?.risk[0]?.at]
      .filter((at): at is Date => at instanceof Date)
      .sort((a, b) => +b - +a)[0];
    const metricAt = token?.metrics[0]?.at;
    const metricFresh = metricAt instanceof Date && Date.now() - +metricAt <= METRIC_FRESH_MS;
    const evidenceFresh = !!newestEvidence && Date.now() - +newestEvidence <= EVIDENCE_FRESH_MS;
    const fresh = metricFresh && evidenceFresh;
    console.log(JSON.stringify({ example: EXAMPLE_MINT, token, fresh, metricFresh, evidenceFresh }, null, 2));
    if (!token || !fresh) {
      console.error(`The demo example ${EXAMPLE_MINT} was not refreshed. The gate will return UNKNOWN, which is correct.`);
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
