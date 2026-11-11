import { buildApp } from './app';
import { createPrisma } from '@narra/database';
import { createQueues, createPersonalResearchQueue, createRedis } from '@narra/queue';
import { createEventStream } from '@narra/realtime';
import { NearRpc, nearConfigFromEnv } from '@narra/near';
import { registerChainRoutes } from './chain';
import { aiProviderFromEnv } from '@narra/ai';
import { createRuntimePrivyVerifier } from './auth';
import { createContractSafety } from './contractSafety';
import { createRuntimeSettings } from './runtime-settings';
import { parseCorsOrigins } from './http';
import { assertEnv } from '@narra/shared';

// First, before any connection is opened: stop with a clear list of what is wrong. Messages never contain a value.
assertEnv('api', process.env, console, undefined, { runtimeAuth: true });

const connection = createRedis();
// The realtime reader blocks its connection (XREAD BLOCK), so it gets one of its own.
const streamReaderConnection = createRedis();
const queues = createQueues(connection);
const personalResearch = createPersonalResearchQueue(connection);
const db = createPrisma();
const runtime = createRuntimeSettings(db);

const chatLlm = aiProviderFromEnv();
if (!chatLlm) console.log('no AI provider configured: chat is off');

// Testnet by default. nearConfigFromEnv validates the URL before the first request.
const near = nearConfigFromEnv();
const nearRpc = new NearRpc({ url: near.rpcUrl });
// The risk gate is mainnet-only because all market evidence is mainnet-only. Keep its contract
// check on mainnet even when NEAR_NETWORK is testnet for the chain-status probe.
const riskRpc = new NearRpc({
  url: process.env.AGENT_RISK_NEAR_RPC_URL || 'https://rpc.mainnet.near.org',
});

// An async function because this file runs as CommonJS under tsx, which has no top-level await.
async function main() {
  const config = await runtime.read();
  if (!config.privyAppId.value || !config.privyVerificationKey.value) throw new Error('Configure Privy in SystemSetting or PRIVY_APP_ID and PRIVY_VERIFICATION_KEY.');
  const app = await buildApp({
    runtime,
    chatLlm,
    contractSafety: createContractSafety(riskRpc),
    account: { db, verifier: createRuntimePrivyVerifier(runtime), requestPersonalResearch: userId => personalResearch.request(userId) },
    // Exact origins only (comma separated). Empty means browsers on other origins are refused.
    http: { corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS), resolveCorsOrigins: runtime.origins, hsts: process.env.HSTS === 'true' },
    // Only when the API is behind a reverse proxy you control. Otherwise a client could spoof its address and dodge rate limits.
    trustProxy: process.env.TRUST_PROXY === 'true',
    // Yes or no only. The values of these settings never leave the server.
    connections: () => [
      { name: 'privy', configured: !!(config.privyAppId.value && config.privyVerificationKey.value), purpose: 'Sign-in' },
      { name: 'near-rpc', configured: true, purpose: 'NEAR chain status and NEP-141 metadata' },
      { name: 'ai-provider', configured: !!process.env.AI_PROVIDER_API_KEY, purpose: 'Opportunity analysis and chat' },
      { name: 'smart-money', configured: process.env.SMART_MONEY_ENABLED !== 'false', purpose: 'Observed public NEAR DEX wallet trades' },
    ],
    ops: { redisPing: async () => (await connection.ping()) === 'PONG', queueCounts: () => queues.counts(), queueHealth: () => queues.health(), marketDataEnabled: process.env.MARKET_DATA_ENABLED !== 'false', aiProviderConfigured: !!process.env.AI_PROVIDER_API_KEY },
    realtime: { stream: createEventStream(connection), readerStream: createEventStream(streamReaderConnection) },
  });
  registerChainRoutes(app, { id: 'near', label: 'NEAR', network: near.network, explorerBase: near.explorerBase }, async () => {
    const block = await nearRpc.latestBlock();
    return { height: block.height };
  });
  const port = Number(process.env.API_PORT || 4000);
  await app.listen({ port, host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close(); // closes WebSocket clients and stops the stream reader first
    await queues.close(); await personalResearch.queue.close(); connection.disconnect(); streamReaderConnection.disconnect(); await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
