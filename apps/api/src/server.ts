import { buildApp } from './app';
import { createPrisma } from '@narra/database';
import { createQueues, createPersonalResearchQueue, createRedis } from '@narra/queue';
import { createEventStream } from '@narra/realtime';
import { SolanaRpc,JupiterClient } from '@narra/solana';
import { NearRpc, nearConfigFromEnv } from '@narra/near';
import { registerChainRoutes } from './chain';
import { createWyntraxHoldings, setWyntraxHoldings } from './entitlements/holdings';
import { makeWalletEventStore } from '@narra/worker-pipeline';
import { aiProviderFromEnv } from '@narra/ai';
import { createRuntimePrivyVerifier } from './auth';
import { createRuntimeSettings } from './runtime-settings';
import { parseCorsOrigins } from './http';
import { assertEnv } from '@narra/shared';

// First, before any connection is opened: stop with a clear list of what is wrong. Messages never contain a value.
assertEnv('api', process.env, console, undefined, { runtimeAuth: true });

const secret = process.env.HELIUS_WEBHOOK_SECRET ?? '';
const connection = createRedis();
// The realtime reader blocks its connection (XREAD BLOCK), so it gets one of its own.
const streamReaderConnection = createRedis();
const queues = createQueues(connection);
const personalResearch = createPersonalResearchQueue(connection);
const db = createPrisma();
const runtime = createRuntimeSettings(db);
const store = makeWalletEventStore(db);

// Edits to tracked wallets ask the worker to sync the Helius webhook. Without Helius credentials the scheduled job is also off.
const syncConfigured = !!(process.env.HELIUS_API_KEY && process.env.HELIUS_WEBHOOK_URL && secret);

const chatLlm = aiProviderFromEnv();
if (!chatLlm) console.log('no AI provider configured: chat is off');

// Testnet by default. nearConfigFromEnv validates the URL before the first request.
const near = nearConfigFromEnv();
const nearRpc = new NearRpc({ url: near.rpcUrl });

// Optional direct SPL fallback for $WYNTRAX access. The signed webhook is primary; this
// only runs when an RPC URL is explicitly configured. It is read-only and never signs.
const wyntraxRpcUrl = process.env.WYNTRAX_RPC_URL?.trim();
const wyntraxCacheSeconds = Number(process.env.WYNTRAX_HOLDING_CACHE_SECONDS ?? '300');
const wyntraxHoldings = wyntraxRpcUrl
  ? createWyntraxHoldings({
      rpc: new SolanaRpc({ url: wyntraxRpcUrl, timeoutMs: 4000 }),
      defaultMint: process.env.WYNTRAX_MINT?.trim() || null,
      cacheTtlMs: (Number.isFinite(wyntraxCacheSeconds) ? wyntraxCacheSeconds : 300) * 1000,
      log: entry => console.warn(entry.code),
    })
  : null;
setWyntraxHoldings(wyntraxHoldings);

// An async function because this file runs as CommonJS under tsx, which has no top-level await.
async function main() {
  const config = await runtime.read();
  const paperQuoteClient=new JupiterClient({apiKey:process.env.JUPITER_API_KEY});
  if (!config.privyAppId.value || !config.privyVerificationKey.value) throw new Error('Configure Privy in SystemSetting or PRIVY_APP_ID and PRIVY_VERIFICATION_KEY.');
  const app = await buildApp({
    runtime,
    wyntrax: { db, secret: process.env.WYNTRAX_WEBHOOK_SECRET || undefined, previousSecret: process.env.WYNTRAX_WEBHOOK_SECRET_PREVIOUS || undefined },
    chatLlm,
    // Quote-only provider. Manual paper routes can never enqueue, sign or send.
    paperQuotes:{getQuote:request=>paperQuoteClient.getQuote(request)},
    requestWalletSync: syncConfigured ? () => queues.requestWalletSync() : undefined,
    enqueueExecution: (job) => queues.enqueueExecution(job),
    account: { db, verifier: createRuntimePrivyVerifier(runtime), requestPersonalResearch: userId => personalResearch.request(userId) },
    webhooks: {
      secret,
      enqueue: (e) => queues.enqueueWalletEvent(e),
      isTracked: (wallet) => store.isTracked(wallet),
      recordReceipt: async value => {const key='health.walletWebhook.receipt';await db.systemSetting.upsert({where:{key},create:{key,value},update:{value}});},
    },
    // Exact origins only (comma separated). Empty means browsers on other origins are refused.
    http: { corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS), resolveCorsOrigins: runtime.origins, hsts: process.env.HSTS === 'true' },
    // Only when the API is behind a reverse proxy you control. Otherwise a client could spoof its address and dodge rate limits.
    trustProxy: process.env.TRUST_PROXY === 'true',
    // Yes or no only. The values of these settings never leave the server.
    connections: () => [
      { name: 'privy', configured: !!(config.privyAppId.value && config.privyVerificationKey.value), purpose: 'Sign-in' },
      { name: 'near-rpc', configured: true, purpose: 'NEAR chain status and balances' },
      { name: 'wyntrax-webhook', configured: !!process.env.WYNTRAX_WEBHOOK_SECRET, purpose: '$WYNTRAX membership events' },
      { name: 'wyntrax-holdings', configured: !!wyntraxHoldings, purpose: 'Direct $WYNTRAX SPL fallback' },
      { name: 'helius-webhooks', configured: syncConfigured, purpose: 'Tracked wallet swap events' },
      { name: 'helius-rpc', configured: !!process.env.HELIUS_RPC_URL, purpose: 'Balances and wallet history' },
      { name: 'jupiter', configured: !!process.env.JUPITER_API_KEY, purpose: 'Swap quotes' },
      { name: 'ai-provider', configured: !!process.env.AI_PROVIDER_API_KEY, purpose: 'Opportunity analysis and position review' },
    ],
    ops: { redisPing: async () => (await connection.ping()) === 'PONG', queueCounts: () => queues.counts(), queueHealth:()=>queues.health(), marketDataEnabled: process.env.MARKET_DATA_ENABLED !== 'false',webhookConfigured:syncConfigured,aiProviderConfigured:!!process.env.AI_PROVIDER_API_KEY },
    balances: process.env.HELIUS_RPC_URL ? new SolanaRpc({ url: process.env.HELIUS_RPC_URL }) : undefined,
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
