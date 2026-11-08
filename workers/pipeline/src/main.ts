/**
 * Worker bootstrap. Reads and writes Postgres through Prisma.
 * This process cannot sign or send transactions and does not consume an execution queue.
 * NEAR RPC is used only for read-only metadata, chain probes and wallet account-kind checks.
 */
import { Worker } from 'bullmq';
import { createPrisma } from '@narra/database';
import { QUEUE_NAMES, createQueues, createRedis } from '@narra/queue';
import { readTregConfig } from '@narra/narrative';
import { runTregJob } from './tregJob';
import { trackEarlyRadarOutcomes } from './earlyRadarTracking';
import { DexScreenerSource, GeckoTerminalSource } from '@narra/market-data';
import { aiProviderFromEnv } from '@narra/ai';
import { NearRpc, nearConfigFromEnv } from '@narra/near';
import { assertEnv } from '@narra/shared';
import { deliverEarlyRadarTelegram, telegramConfigFromEnv, TelegramBotApiTransport } from './telegram';
import { nearMetadataSource } from './tokenMetadata';
import { refreshMarketData } from './marketData';
import { resolveTokens } from './tokenResolution';
import { attributeNarrativeMentions } from './narrativeTokens';
import { scanSocialTokens } from './socialTokens';
import { runAiAnalysis } from './aiAnalysis';
import { trackOutcomes } from './outcomeTracking';
import { dispatchAlerts } from './notifications';
import { publishNewEvents } from './realtimePublisher';
import { refreshSmartMoney, smartMoneyIntervalMs, smartMoneyMaxPools, smartMoneyRulesFromEnv } from './smartMoney';

// First, before any connection is opened: stop with a clear list of what is wrong. Messages never contain a value.
assertEnv('worker');
const tregConfig = readTregConfig(process.env);

const connection = createRedis();
const queues = createQueues(connection);
const db = createPrisma();
const near = nearConfigFromEnv();
const rpc = new NearRpc({ url: near.rpcUrl, timeoutMs: 15_000 });

if (!tregConfig) console.log('no narrative providers configured: set TREG_NARRATIVE_ENABLED and Treg configuration to enable social ingestion');

// Market data and public trade observations use free APIs that need no key.
const gecko = new GeckoTerminalSource({ baseUrl: process.env.GECKOTERMINAL_BASE_URL });
const marketDeps = process.env.MARKET_DATA_ENABLED === 'false' ? null : {
  metadata: nearMetadataSource(rpc),
  quotes: new DexScreenerSource({ baseUrl: process.env.DEXSCREENER_BASE_URL }),
  info: gecko,
  launches: {
    name: gecko.name,
    getNewPools: async () => {
      const results = await Promise.allSettled([gecko.getNewPools(), gecko.getTrendingPools()]);
      if (results.every(r => r.status === 'rejected')) throw new Error('Pool discovery unavailable');
      for (const r of results) if (r.status === 'rejected') console.error('One pool discovery source is unavailable');
      return [...new Map(results.flatMap(r => r.status === 'fulfilled' ? r.value : []).map(pool => [pool.mint, pool])).values()];
    },
  },
};
if (!marketDeps) console.log('market data disabled');

// Smart money is independent of the market refresh: it only reads the public trade feed and stored token evidence.
// GeckoTerminal's `near` data is mainnet, so the account-kind check must not inherit a testnet NEAR_RPC_URL.
// FastNEAR is the low-latency default; the public mainnet RPC is a fallback when it is rate-limited.
const smartMoneyRpcs = [
  process.env.SMART_MONEY_ACCOUNT_RPC_URL?.trim() || 'https://free.rpc.fastnear.com',
  'https://rpc.mainnet.near.org',
].filter((url, index, all) => all.indexOf(url) === index).map(url => new NearRpc({ url, timeoutMs: 15_000 }));
const isContractAccount = async (address: string): Promise<boolean> => {
  let last: unknown;
  for (const rpc of smartMoneyRpcs) {
    try { return await rpc.isContractAccount(address); }
    catch (error) { last = error; }
  }
  throw last instanceof Error ? last : new Error('ACCOUNT_KIND_UNAVAILABLE');
};
const smartMoneyDeps = process.env.SMART_MONEY_ENABLED === 'false' ? null : {
  trades: gecko,
  accountKind: { isContract: isContractAccount },
  maxPools: smartMoneyMaxPools(),
  rules: smartMoneyRulesFromEnv(),
};
if (!smartMoneyDeps) console.log('smart money observation disabled');

const llm = aiProviderFromEnv();
if (!llm) console.log('no AI provider configured');

// Telegram is a delivery layer for global research alerts only. It is off unless both values are set.
const telegramConfig = telegramConfigFromEnv();
const telegramTransport = telegramConfig ? new TelegramBotApiTransport(telegramConfig.token, telegramConfig.botApiBase) : null;
if (!telegramConfig) console.log('telegram delivery off: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
else console.log('telegram delivery on');

// Registering the repeating jobs. Done in an async block because this file runs as CommonJS under tsx, which has no top-level await.
const scheduled = (async () => {
  await queues.scheduleAiAnalysis();
  await queues.scheduleNarrativeIngestion(tregConfig?.intervalMs);
  await queues.scheduleTokenResolution();
  await queues.scheduleMarketData();
  if (smartMoneyDeps) await queues.scheduleSmartMoney(smartMoneyIntervalMs());
  await queues.scheduleOutcomeTracking();
  await queues.scheduleNotificationDispatch();
  await queues.scheduleRealtimePublish();
  if (telegramConfig) await queues.scheduleTelegramDelivery();
})();
scheduled.then(() => console.log('schedules registered'), (e) => { console.error('could not register schedules:', e instanceof Error ? e.message : e); process.exit(1); });

const workers = [
  new Worker(QUEUE_NAMES.aiAnalysis, async () => JSON.stringify(await runAiAnalysis(db, { llm })), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.tokenResolution, async () => JSON.stringify({ mentionLinks: await attributeNarrativeMentions(db), ...(await resolveTokens(db)), social: await scanSocialTokens(db, { quotes: marketDeps?.quotes ?? null }).catch(() => 'social scan failed') }), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.marketData, async () => (marketDeps ? JSON.stringify(await refreshMarketData(db, marketDeps)) : 'disabled'), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.smartMoney, async () => {
    if (!smartMoneyDeps) return 'disabled';
    const summary = await refreshSmartMoney(db, smartMoneyDeps);
    console.log(JSON.stringify({ msg: 'smart_money_observation', ...summary }));
    return JSON.stringify(summary);
  }, { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.narrativeIngestion, async (job) => {
    if (!tregConfig) return 'disabled';
    return runTregJob(db, tregConfig, job);
  }, { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.outcomeTracking, async () => JSON.stringify({ decisions: await trackOutcomes(db), earlyRadar: await trackEarlyRadarOutcomes(db) }), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.notificationDispatch, async () => JSON.stringify(await dispatchAlerts(db)), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.realtimePublish, async () => JSON.stringify(await publishNewEvents(db, connection)), { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.telegramDelivery, async () => {
    if (!telegramConfig || !telegramTransport) return 'telegram disabled';
    const summary = await deliverEarlyRadarTelegram(db, {
      chatId: telegramConfig.chatId, transport: telegramTransport, dryRun: false,
      maxAgeMs: telegramConfig.maxAgeMs, limit: telegramConfig.limit, delayMs: telegramConfig.delayMs,
    });
    if (summary.lastError || summary.sent || summary.failed || summary.stopped) {
      console.log(JSON.stringify({
        msg: 'telegram_delivery', scanned: summary.scanned, candidates: summary.candidates,
        sent: summary.sent, stale: summary.skippedStale, failed: summary.failed,
        stopped: summary.stopped, error: summary.lastError,
      }));
    }
    return JSON.stringify(summary);
  }, { connection, concurrency: 1 }),
];
for (const w of workers) w.on('failed', (job, err) => console.error(JSON.stringify({ msg: 'job_failed', queue: w.name, id: job?.id, err: err.message })));

const shutdown = async () => { await Promise.all(workers.map((w) => w.close())); await queues.close(); connection.disconnect(); await db.$disconnect(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.log('workers started');
