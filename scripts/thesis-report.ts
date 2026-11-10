import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createPrisma } from '@narra/database';
import { MIN_HOLDERS, MIN_LIQUIDITY_USD } from '@narra/token-intel';
import { researchCoverage, renderResearchCoverage } from '@narra/worker-pipeline';
import { earlyRadarReport } from '../workers/pipeline/src/earlyRadarTracking';

const PRICE_FRESH_MS = 15 * 60_000;
const EVIDENCE_FRESH_MS = 60 * 60_000;
const OUTPUT = 'THESIS_EVIDENCE.md';

const number = (value: { toString(): string } | null | undefined): number | null => {
  if (value == null) return null;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const fmt = (value: number | null | undefined, digits = 0): string =>
  value == null ? 'unknown' : value.toLocaleString('en-US', { maximumFractionDigits: digits });

const pct = (value: number | null | undefined): string =>
  value == null ? 'unknown' : `${value.toFixed(1)}%`;

async function buildReport(db: ReturnType<typeof createPrisma>, now: Date, days: number) {
  const since = new Date(+now - days * 86_400_000);
  const priceFreshSince = new Date(+now - PRICE_FRESH_MS);
  const evidenceFreshSince = new Date(+now - EVIDENCE_FRESH_MS);

  const [
    narrativesActive, narrativesTotal, mentions, tokensObserved,
    tokensWithPrice, tokensWithHolders, tokensWithRisk,
    opportunities, earlyAlerts, links,
    smartWallets, eligibleWallets, smartTrades, smartVolume, oldestTrade, newestTrade,
  ] = await Promise.all([
    db.narrative.count({ where: { stage: { not: 'DEAD' } } }),
    db.narrative.count(),
    db.tokenMention.count({ where: { at: { gte: since, lte: now } } }),
    db.token.count({ where: { blacklisted: false } }),
    db.token.count({ where: { blacklisted: false, metrics: { some: { at: { gte: priceFreshSince, lte: now } } } } }),
    db.token.count({ where: { blacklisted: false, holders: { some: { at: { gte: evidenceFreshSince, lte: now } } } } }),
    db.token.count({ where: { blacklisted: false, risk: { some: { at: { gte: evidenceFreshSince, lte: now } } } } }),
    db.opportunity.count({ where: { createdAt: { gte: since, lte: now } } }),
    db.alert.count({ where: { kind: { startsWith: 'EARLY_RADAR' }, createdAt: { gte: since, lte: now } } }),
    db.narrativeTokenRelation.count(),
    db.smartWallet.count(),
    db.smartWalletProfile.count({ where: { eligible: true } }),
    db.smartWalletTrade.count({ where: { at: { gte: since, lte: now } } }),
    db.smartWalletTrade.aggregate({ where: { at: { gte: since, lte: now } }, _sum: { valueUsd: true } }),
    db.smartWalletTrade.findFirst({ orderBy: { at: 'asc' }, select: { at: true } }),
    db.smartWalletTrade.findFirst({ orderBy: { at: 'desc' }, select: { at: true } }),
  ]);

  const linkedTokens = await db.token.findMany({
    where: { blacklisted: false, narratives: { some: {} } },
    select: {
      id: true, mint: true, symbol: true,
      metrics: { orderBy: { at: 'desc' }, take: 1, select: { liquidityUsd: true, marketCapUsd: true, at: true } },
      holders: { orderBy: { at: 'desc' }, take: 1, select: { holders: true, top10Pct: true, at: true } },
      risk: { orderBy: { at: 'desc' }, take: 1, select: { riskScore: true, flags: true } },
      narratives: { select: { relation: true } },
    },
  });

  let nonSuspicious = 0, withLiquidity = 0, withHolders = 0, withBoth = 0;
  let freshPrice = 0, freshHolders = 0, freshBoth = 0, freshConfirmed = 0;
  const top10Values: number[] = [];
  for (const token of linkedTokens) {
    const metric = token.metrics[0];
    const holder = token.holders[0];
    const liquidity = number(metric?.liquidityUsd);
    const holders = holder?.holders ?? null;
    const priceFresh = !!metric && +metric.at >= +priceFreshSince && +metric.at <= +now;
    const holderFresh = !!holder && +holder.at >= +evidenceFreshSince && +holder.at <= +now;
    if (priceFresh) freshPrice++;
    if (holderFresh) freshHolders++;
    if (priceFresh && holderFresh) freshBoth++;
    if (top10Values.length < 10_000 && holder?.top10Pct != null) top10Values.push(holder.top10Pct);
    if (token.narratives.some(relation => relation.relation !== 'SUSPICIOUS')) nonSuspicious++;
    if (liquidity != null && liquidity >= MIN_LIQUIDITY_USD) withLiquidity++;
    if (holders != null && holders >= MIN_HOLDERS) withHolders++;
    if (liquidity != null && liquidity >= MIN_LIQUIDITY_USD && holders != null && holders >= MIN_HOLDERS) {
      withBoth++;
      if (priceFresh && holderFresh) freshConfirmed++;
    }
  }

  const linkedIds = linkedTokens.map(token => token.id);
  const [opportunityTokens, earlyRadarTokens] = await Promise.all([
    linkedIds.length
      ? db.opportunity.findMany({ where: { tokenId: { in: linkedIds }, createdAt: { gte: since, lte: now } }, distinct: ['tokenId'], select: { tokenId: true } })
      : [],
    linkedIds.length
      ? db.alert.findMany({ where: { kind: { startsWith: 'EARLY_RADAR' }, refType: 'TOKEN', refId: { in: linkedIds }, createdAt: { gte: since, lte: now } }, distinct: ['refId'], select: { refId: true } })
      : [],
  ]);

  const radar = await earlyRadarReport(db, since, now);
  const coverage = await researchCoverage(db, now);

  return {
    generatedAt: now.toISOString(),
    window: { from: since.toISOString(), to: now.toISOString(), days },
    universe: {
      narrativesActive, narrativesTotal, mentions, tokensObserved,
      tokensWithPrice, tokensWithHolders, tokensWithRisk,
      opportunities, earlyAlerts, narrativeTokenLinks: links,
    },
    conversion: {
      linkedTokens: linkedTokens.length,
      nonSuspicious,
      withLiquidity,
      withHolders,
      withBoth,
      freshPrice,
      freshHolders,
      freshBoth,
      freshConfirmed,
      withOpportunity: opportunityTokens.length,
      withEarlyRadar: earlyRadarTokens.length,
      confirmedSharePct: linkedTokens.length ? (withBoth / linkedTokens.length) * 100 : null,
      freshConfirmedSharePct: linkedTokens.length ? (freshConfirmed / linkedTokens.length) * 100 : null,
      medianTop10Pct: median(top10Values),
      floors: { liquidityUsd: MIN_LIQUIDITY_USD, holders: MIN_HOLDERS },
    },
    smartMoney: {
      wallets: smartWallets,
      eligible: eligibleWallets,
      trades: smartTrades,
      volumeUsd: number(smartVolume._sum.valueUsd),
      observedFrom: oldestTrade?.at.toISOString() ?? null,
      observedTo: newestTrade?.at.toISOString() ?? null,
    },
    earlyRadar: {
      events: radar.total,
      read: radar.read,
      truncated: radar.truncated,
      groups: radar.groups,
      caveats: radar.caveats,
    },
    collection: coverage,
  };
}

function renderMarkdown(report: Awaited<ReturnType<typeof buildReport>>): string {
  const lines: string[] = [
    '# NARRAX evidence snapshot',
    '',
    `Generated: ${report.generatedAt}`,
    `Window: ${report.window.from} to ${report.window.to} (${report.window.days} days)`,
    '',
    'This is a generated snapshot of the local research database, not a backtest and not a price prediction. No value is hardcoded; missing data stays unknown.',
    '',
    '## Research universe',
    '',
    '| Metric | Value |',
    '| --- | ---: |',
    `| Active narratives | ${fmt(report.universe.narrativesActive)} |`,
    `| All narratives | ${fmt(report.universe.narrativesTotal)} |`,
    `| Narrative mentions in window | ${fmt(report.universe.mentions)} |`,
    `| Tokens observed | ${fmt(report.universe.tokensObserved)} |`,
    `| Tokens with a fresh price | ${fmt(report.universe.tokensWithPrice)} |`,
    `| Tokens with fresh holder evidence | ${fmt(report.universe.tokensWithHolders)} |`,
    `| Tokens with a fresh risk row | ${fmt(report.universe.tokensWithRisk)} |`,
    `| Narrative-token links | ${fmt(report.universe.narrativeTokenLinks)} |`,
    `| Opportunities in window | ${fmt(report.universe.opportunities)} |`,
    `| Early Radar alerts in window | ${fmt(report.universe.earlyAlerts)} |`,
    '',
    '## Narrative-to-token conversion',
    '',
    `Floors: liquidity >= $${fmt(report.conversion.floors.liquidityUsd)} and holders >= ${fmt(report.conversion.floors.holders)}.`,
    '',
    '| Cohort | Tokens | Share of linked |',
    '| --- | ---: | ---: |',
    `| Linked to a narrative | ${fmt(report.conversion.linkedTokens)} | 100.0% |`,
    `| …with a non-suspicious relation | ${fmt(report.conversion.nonSuspicious)} | ${pct(report.conversion.linkedTokens ? report.conversion.nonSuspicious / report.conversion.linkedTokens * 100 : null)} |`,
    `| …with liquidity >= $${fmt(report.conversion.floors.liquidityUsd)} | ${fmt(report.conversion.withLiquidity)} | ${pct(report.conversion.linkedTokens ? report.conversion.withLiquidity / report.conversion.linkedTokens * 100 : null)} |`,
    `| …with >= ${fmt(report.conversion.floors.holders)} holders | ${fmt(report.conversion.withHolders)} | ${pct(report.conversion.linkedTokens ? report.conversion.withHolders / report.conversion.linkedTokens * 100 : null)} |`,
    `| …with both floors (confirmed) | ${fmt(report.conversion.withBoth)} | ${pct(report.conversion.confirmedSharePct)} |`,
    `| …confirmed with fresh evidence | ${fmt(report.conversion.freshConfirmed)} | ${pct(report.conversion.freshConfirmedSharePct)} |`,
    `| …with an opportunity | ${fmt(report.conversion.withOpportunity)} | ${pct(report.conversion.linkedTokens ? report.conversion.withOpportunity / report.conversion.linkedTokens * 100 : null)} |`,
    `| …with an Early Radar alert | ${fmt(report.conversion.withEarlyRadar)} | ${pct(report.conversion.linkedTokens ? report.conversion.withEarlyRadar / report.conversion.linkedTokens * 100 : null)} |`,
    '',
    `Fresh price rows: ${fmt(report.conversion.freshPrice)}; fresh holder evidence: ${fmt(report.conversion.freshHolders)}; both fresh: ${fmt(report.conversion.freshBoth)}.`,
    `Median top-10 concentration among linked tokens with holder evidence: ${pct(report.conversion.medianTop10Pct)}.`,
    '',
    '## Early Radar outcomes',
    '',
  ];

  if (!report.earlyRadar.groups.length) {
    lines.push('No Early Radar alerts in this window. This is a real zero-count, not a missing value.');
  } else {
    lines.push('| Cohort | Horizon | Alerts | Independent | Known | Pending | Unknown | Median return | Win rate | Sufficient |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const group of report.earlyRadar.groups) {
      for (const horizon of group.horizons) {
        lines.push(`| ${group.profile}/${group.tier}/${group.route}/${group.matchKind} | ${horizon.hours}h | ${fmt(horizon.raw)} | ${fmt(horizon.independent)} | ${fmt(horizon.known)} | ${fmt(horizon.pending)} | ${fmt(horizon.unknown)} | ${horizon.returns.median == null ? 'unknown' : `${horizon.returns.median.toFixed(1)}%`} | ${pct(horizon.returns.winRate == null ? null : horizon.returns.winRate * 100)} | ${horizon.returns.sufficient ? 'yes' : 'no'} |`);
      }
    }
    lines.push('', `Events read: ${fmt(report.earlyRadar.read)} of ${fmt(report.earlyRadar.events)}${report.earlyRadar.truncated ? ' (truncated)' : ''}.`);
  }

  lines.push('', '## Smart money observations', '',
    '| Metric | Value |', '| --- | ---: |',
    `| Wallets observed | ${fmt(report.smartMoney.wallets)} |`,
    `| Eligible profiles | ${fmt(report.smartMoney.eligible)} |`,
    `| Trades in window | ${fmt(report.smartMoney.trades)} |`,
    `| Observed volume in window | $${fmt(report.smartMoney.volumeUsd, 2)} |`,
    `| Observation starts | ${report.smartMoney.observedFrom ?? 'unknown'} |`,
    `| Observation ends | ${report.smartMoney.observedTo ?? 'unknown'} |`,
    '',
    'Smart-money history starts when collection starts. The provider feed is a recent window, not a complete archive.',
    '',
    renderResearchCoverage(report.collection),
    '',
    '## Caveats',
    '',
    '- Market evidence is mainnet NEAR only; there is no testnet market feed.',
    '- Holder data may come from the NearBlocks fallback. Tokens NearBlocks has not indexed stay unknown.',
    '- Counts are current database rows, not a complete market census.',
    '- Early Radar returns are gross observed price returns, not executable PnL. The analytics report caveats apply in full.',
    '- A missing value is reported as unknown, never as zero.',
    '');

  return lines.join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      days: { type: 'string', default: '7' },
      write: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('npm run thesis:report -- [--days 7] [--write] [--json]\nRead-only evidence snapshot from the local research database. --write writes THESIS_EVIDENCE.md.');
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('--days must be an integer from 1 to 90');

  const db = createPrisma();
  try {
    const report = await buildReport(db, new Date(), days);
    if (values.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const markdown = renderMarkdown(report);
    if (values.write) {
      await writeFile(OUTPUT, markdown, 'utf8');
      console.log(`Wrote ${OUTPUT}`);
    } else {
      console.log(markdown);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  // Connection errors may contain credentials; keep the CLI failure generic.
  console.error('Thesis report failed. Check arguments, DATABASE_URL and database availability privately.');
  if (process.env.DEBUG) console.error(error);
  process.exitCode = 1;
});
