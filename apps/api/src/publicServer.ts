import { buildApp } from './app';
import { createPrisma } from '@narra/database';
import { NearRpc, nearConfigFromEnv } from '@narra/near';
import { registerChainRoutes } from './chain';
import { createContractSafety } from './contractSafety';
import { parseCorsOrigins } from './http';

/**
 * Public judge API. Serves only the unauthenticated landing snapshot, chain status and agent risk
 * gate. It deliberately does not require Privy, Redis or an AI provider, so a judge can run the
 * public demo with Postgres alone.
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the public demo API');
  const db = createPrisma();
  const near = nearConfigFromEnv();
  const rpc = new NearRpc({ url: near.rpcUrl, timeoutMs: 15_000 });
  // The risk gate is mainnet-only because all market evidence is mainnet-only. Keep its contract
  // check on mainnet even when NEAR_NETWORK is testnet for the chain-status probe.
  const riskRpcUrl = process.env.AGENT_RISK_NEAR_RPC_URL || 'https://free.rpc.fastnear.com';
  const riskRpc = new NearRpc({
    url: riskRpcUrl,
    timeoutMs: 15_000,
  });
  const fallbackRiskRpc = new NearRpc({
    url: riskRpcUrl === 'https://free.rpc.fastnear.com' ? 'https://rpc.mainnet.near.org' : 'https://free.rpc.fastnear.com',
    timeoutMs: 15_000,
  });

  const app = await buildApp({
    publicDb: db,
    publicOnly: true,
    contractSafety: createContractSafety(riskRpc, { fallbackRpc: fallbackRiskRpc }),
    // Exact origins only. Empty means browsers on other origins are refused.
    http: { corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS), hsts: process.env.HSTS === 'true' },
    trustProxy: process.env.TRUST_PROXY === 'true',
  });
  registerChainRoutes(app, { id: 'near', label: 'NEAR', network: near.network, explorerBase: near.explorerBase }, async () => {
    const block = await rpc.latestBlock();
    return { height: block.height };
  });

  const port = Number(process.env.API_PORT || 4000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`public judge API listening on :${port} (no Privy, no Redis)`);

  const shutdown = async () => {
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
