/**
 * Worker bootstrap. Reads and writes Postgres through Prisma.
 * This process cannot sign or send transactions and does NOT consume the execution queue (workers/executor does).
 * Set HELIUS_RPC_URL to enable real balances for the fan-out and portfolio snapshots. Without it the chain ports throw and real-wallet users are skipped.
 */
import { Worker } from 'bullmq';
import {heliusMetadataSource} from './tokenMetadata';
import { createPrisma } from '@narra/database';
import { AiScreeningJobSchema, QUEUE_NAMES, SwapEventSchema, createQueues, createRedis } from '@narra/queue';
import { HeliusWebhooks, JupiterClient, SolanaRpc } from '@narra/solana';
import { readTregConfig } from '@narra/narrative';
import { runTregJob } from './tregJob';
import { trackEarlyRadarOutcomes } from './earlyRadarTracking';
import { DexScreenerSource, GeckoTerminalSource } from '@narra/market-data';
import { aiProviderFromEnv } from '@narra/ai';
import { makeWalletEventStore, processWalletEvent, ingestNarratives, makeChainPorts, refreshMarketData, processScreeningJob, runAiAnalysis, recomputeWalletIntelligence, resolveTokens, attributeNarrativeMentions, scanSocialTokens, monitorPositions, syncWalletWebhook, ingestWalletFunding, rebuildFundingGraph, scanEarlyBuyers, discoverCandidates, expirePendingConfirmations, fanOutEntries, fanOutExits, writePortfolioSnapshots, trackOutcomes, dispatchAlerts, publishNewEvents, type ChainPorts, type WalletEventDeps } from './index';
import { assertEnv } from '@narra/shared';
import { makeDeveloperHoldingSource } from './developerHoldings';

// First, before any connection is opened: stop with a clear list of what is wrong. Messages never contain a value.
assertEnv('worker');
const tregConfig = readTregConfig(process.env);

const connection = createRedis();
const queues = createQueues(connection);
const db = createPrisma();
const jupiter = new JupiterClient({ apiKey: process.env.JUPITER_API_KEY });
const notWired = (name: string) => async (): Promise<never> => { throw new Error(`${name} needs HELIUS_RPC_URL`); };
// Without an RPC URL the ports throw, so real-wallet work fails closed instead of guessing balances.
const chain: ChainPorts = process.env.HELIUS_RPC_URL
  ? makeChainPorts({ db, rpc: new SolanaRpc({ url: process.env.HELIUS_RPC_URL }), jupiter })
  : { getSolBalance: notWired('getSolBalance'), getPortfolioValueSol: notWired('getPortfolioValueSol'), getTokenBaseUnits: notWired('getTokenBaseUnits') };

const walletStore = makeWalletEventStore(db);
const walletDeps: WalletEventDeps = { ...walletStore, enqueueAiScreening: (j) => queues.enqueueAiScreening(j) };

// Real wallets are only touched when an RPC is configured. Without one, SEMI_AUTO and AUTO users are skipped by the fan-out
// and their jobs fail closed; PAPER and SHADOW users use the paper ledger and need no RPC.
const realChain: ChainPorts | null = process.env.HELIUS_RPC_URL ? chain : null;
if (!tregConfig) console.log('no narrative providers configured: set TREG_NARRATIVE_ENABLED and Treg configuration to enable social ingestion');

// Market data comes from free public APIs that need no key. Set MARKET_DATA_ENABLED=false to turn the job off.
// With it off, no prices, holders or risk rows are written, so token resolution ranks nothing (fail closed).
const marketDeps = process.env.MARKET_DATA_ENABLED === 'false' ? null : (() => {
  const gecko = new GeckoTerminalSource({ baseUrl: process.env.GECKOTERMINAL_BASE_URL });
   return { metadata:process.env.HELIUS_RPC_URL?heliusMetadataSource(process.env.HELIUS_RPC_URL):null,quotes: new DexScreenerSource({ baseUrl: process.env.DEXSCREENER_BASE_URL }), info: gecko, launches: gecko, developerHoldings: process.env.HELIUS_RPC_URL ? makeDeveloperHoldingSource(db, new SolanaRpc({ url: process.env.HELIUS_RPC_URL, timeoutMs: 15_000 })) : null };
})();
if (!marketDeps) console.log('market data disabled');

// Wallet jobs. History scans need an RPC URL. Webhook sync needs the Helius API key, the public webhook URL and the shared secret.
// Each job does nothing when its inputs are missing, and none of them can trade.
const historyRpc = process.env.HELIUS_RPC_URL ? new SolanaRpc({ url: process.env.HELIUS_RPC_URL, timeoutMs: 15_000 }) : null;
const syncDeps = process.env.HELIUS_API_KEY && process.env.HELIUS_WEBHOOK_URL && process.env.HELIUS_WEBHOOK_SECRET
  ? { client: new HeliusWebhooks({ apiKey: process.env.HELIUS_API_KEY }), cfg: { webhookUrl: process.env.HELIUS_WEBHOOK_URL, authHeader: process.env.HELIUS_WEBHOOK_SECRET } }
  : null;
if (!historyRpc) console.log('no HELIUS_RPC_URL: wallet funding and discovery scans are off');
if (!syncDeps) console.log('wallet webhook sync is off: set HELIUS_API_KEY, HELIUS_WEBHOOK_URL and HELIUS_WEBHOOK_SECRET');

// With no key the AI jobs skip. Nothing else depends on them, and nothing trades on their absence.
const llm = aiProviderFromEnv();
if (!llm) console.log('no AI provider configured');

// Registering the repeating jobs. Done in an async block because this file runs as CommonJS under tsx, which has no top-level await.
const scheduled = (async () => {
  await queues.scheduleWalletIntelligence();
  await queues.scheduleAiAnalysis();
  await queues.scheduleNarrativeIngestion(tregConfig?.intervalMs);
  await queues.scheduleTokenResolution();
  await queues.scheduleMarketData();
  await queues.scheduleWalletSync();
  await queues.schedulePositionMonitor();
  await queues.scheduleWalletFunding();
  await queues.scheduleWalletDiscovery();
  await queues.scheduleEntryFanOut();
  await queues.scheduleExitFanOut();
  await queues.schedulePortfolioSnapshots();
  await queues.scheduleOutcomeTracking();
  await queues.scheduleNotificationDispatch();
  await queues.scheduleRealtimePublish();
})();
scheduled.then(() => console.log('schedules registered'), (e) => { console.error('could not register schedules:', e instanceof Error ? e.message : e); process.exit(1); });

const workers = [
  new Worker(QUEUE_NAMES.walletEvents, (j) => processWalletEvent(SwapEventSchema.parse(j.data), walletDeps), { connection, concurrency: 8 }),
  // One recompute at a time: it rewrites profiles, clusters and consensus together.
  new Worker(QUEUE_NAMES.walletIntelligence, async () => JSON.stringify(await recomputeWalletIntelligence(db)), { connection, concurrency: 1 }),
  // Position monitor: recommends exits and raises alerts. It never closes a position or places an order. The AI review is optional.
  new Worker(QUEUE_NAMES.positionMonitor, async () => JSON.stringify(await monitorPositions(db, { llm })), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.aiAnalysis, async () => JSON.stringify(await runAiAnalysis(db, { llm })), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.aiScreening, async (j) => JSON.stringify(await processScreeningJob(db, { llm }, AiScreeningJobSchema.parse(j.data))), { connection, concurrency: 2 }),
  new Worker(QUEUE_NAMES.tokenResolution, async () => JSON.stringify({ mentionLinks: await attributeNarrativeMentions(db), ...(await resolveTokens(db)), social: await scanSocialTokens(db, { quotes: marketDeps?.quotes ?? null }).catch(() => 'social scan failed') }), { connection, concurrency: 1 }),
  // One refresh at a time: the sources are rate limited per process.
  new Worker(QUEUE_NAMES.marketData, async () => (marketDeps ? JSON.stringify(await refreshMarketData(db, marketDeps)) : 'disabled'), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.walletSync, async () => (syncDeps ? JSON.stringify(await syncWalletWebhook(db, syncDeps.client, syncDeps.cfg)) : 'not configured'), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.walletFunding, async () => {
    const ingest = historyRpc ? await ingestWalletFunding(db, historyRpc) : null;
    return JSON.stringify({ ingest, graph: await rebuildFundingGraph(db) });
  }, { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.walletDiscovery, async () => (historyRpc ? JSON.stringify({ scan: await scanEarlyBuyers(db, historyRpc), discovery: await discoverCandidates(db) }) : 'needs HELIUS_RPC_URL'), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.narrativeIngestion, async (job) => {
    if (!tregConfig) return 'disabled';
    return runTregJob(db, tregConfig, job);
  }, { connection, concurrency: 1 }),
  // Fan-out only creates jobs. It cannot trade, and neither can the jobs: with no Executor they end as a paper fill, a pending confirmation, a log row, a dry run or execution_disabled.
  new Worker(QUEUE_NAMES.entryFanOut, async () => {
    const expired = await expirePendingConfirmations(db, new Date());
    return JSON.stringify({ expired, ...(await fanOutEntries(db, { chain: realChain, enqueue: (j) => queues.enqueueExecution(j) })) });
  }, { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.exitFanOut, async () => JSON.stringify(await fanOutExits(db, { enqueue: (j) => queues.enqueueExecution(j) })), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.outcomeTracking, async () => JSON.stringify({decisions:await trackOutcomes(db),earlyRadar:await trackEarlyRadarOutcomes(db)}), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.portfolioSnapshots, async () => JSON.stringify(await writePortfolioSnapshots(db, { chain: realChain })), { connection, concurrency: 1 }),
  // Alerts to per-user notifications. Idempotent and safe to run on several workers at once.
  new Worker(QUEUE_NAMES.notificationDispatch, async () => JSON.stringify(await dispatchAlerts(db)), { connection, concurrency: 1 }),
  // New rows to the realtime stream. A failure here never affects the jobs that wrote the rows.
  new Worker(QUEUE_NAMES.realtimePublish, async () => JSON.stringify(await publishNewEvents(db, connection)), { connection, concurrency: 1 }),
  // The execution queue is consumed by workers/executor, a separate process, since B5a. This process only enqueues.
];
for (const w of workers) w.on('failed', (job, err) => console.error(JSON.stringify({ msg: 'job_failed', queue: w.name, id: job?.id, err: err.message })));

const shutdown = async () => { await Promise.all(workers.map((w) => w.close())); await queues.close(); connection.disconnect(); await db.$disconnect(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.log('workers started');
