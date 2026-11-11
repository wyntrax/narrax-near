import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createPrisma } from '@narra/database';
import { isBridgedAsset } from '@narra/shared';
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

  const allLinkedTokens = await db.token.findMany({
    where: { blacklisted: false, narratives: { some: {} } },
    select: {
      id: true, mint: true, symbol: true,
      metrics: { orderBy: { at: 'desc' }, take: 1, select: { liquidityUsd: true, marketCapUsd: true, at: true } },
      holders: { orderBy: { at: 'desc' }, take: 1, select: { holders: true, top10Pct: true, at: true } },
      risk: { orderBy: { at: 'desc' }, take: 1, select: { riskScore: true, flags: true } },
      narratives: { select: { relation: true } },
    },
  });
  const bridgedTokens = allLinkedTokens.filter(token => isBridgedAsset(token.mint)).length;
  const linkedTokens = allLinkedTokens.filter(token => !isBridgedAsset(token.mint));

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
      bridgedTokens,
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

function renderMarkdown(report: Awaited<ReturnType<typeof buildReport>>, includeChart = false): string {
  const lines: string[] = [
    '# NARRAX evidence snapshot',
    '',
    `Generated: ${report.generatedAt}`,
    `Window: ${report.window.from} to ${report.window.to} (${report.window.days} days)`,
    '',
    'This is a generated snapshot of the local research database, not a backtest and not a price prediction. No value is hardcoded; missing data stays unknown.',
    '',
    ...(includeChart ? ['![NARRAX evidence snapshot](./THESIS_EVIDENCE.svg)', ''] : []),
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
    ...(report.conversion.bridgedTokens
      ? [`Excluded ${fmt(report.conversion.bridgedTokens)} bridged-asset tokens (*.omft.near, *.omdep.near, *.bridge.near) from this cohort.`, '']
      : []),
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

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]!));
}

function renderEvidenceSvg(report: Awaited<ReturnType<typeof buildReport>>): string {
  const width = 1000, height = 620;
  const conversionMax = Math.max(1, report.conversion.linkedTokens);
  const coverageMax = Math.max(1, report.universe.tokensObserved);
  const bar = (label: string, value: number, max: number, y: number, color: string): string => {
    const x = 300, w = 520, h = 22;
    const fill = value <= 0 ? 0 : Math.max(2, Math.min(w, (value / max) * w));
    return `<text x="40" y="${y + 16}" font-size="13" fill="#111">${escapeXml(label)}</text>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#eeeeee" rx="3"/>
      <rect x="${x}" y="${y}" width="${fill.toFixed(1)}" height="${h}" fill="${color}" rx="3"/>
      <text x="${x + w + 16}" y="${y + 16}" font-size="13" fill="#111" font-weight="600">${fmt(value)}</text>`;
  };
  const conversionRows = [
    ['Linked to a narrative', report.conversion.linkedTokens],
    ['Non-suspicious relation', report.conversion.nonSuspicious],
    [`Liquidity >= $${fmt(report.conversion.floors.liquidityUsd)}`, report.conversion.withLiquidity],
    [`Holders >= ${fmt(report.conversion.floors.holders)}`, report.conversion.withHolders],
    ['Both floors (confirmed)', report.conversion.withBoth],
    ['With an opportunity', report.conversion.withOpportunity],
    ['With an Early Radar alert', report.conversion.withEarlyRadar],
  ].map(([label, value], index) => bar(String(label), Number(value), conversionMax, 112 + index * 32, '#111')).join('\n');
  const coverageRows = [
    ['Tokens observed', report.universe.tokensObserved],
    ['Fresh price', report.universe.tokensWithPrice],
    ['Fresh holder evidence', report.universe.tokensWithHolders],
    ['Fresh risk row', report.universe.tokensWithRisk],
  ].map(([label, value], index) => bar(String(label), Number(value), coverageMax, 400 + index * 32, '#777')).join('\n');
  const empty = report.conversion.linkedTokens === 0
    ? '<text x="300" y="128" font-size="13" fill="#777">No linked research tokens yet.</text>'
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="NARRAX evidence snapshot" font-family="Arial, Helvetica, sans-serif">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="40" y="42" font-size="22" font-weight="700" fill="#111">NARRAX evidence snapshot</text>
  <text x="40" y="66" font-size="12" fill="#666">Generated ${escapeXml(report.generatedAt)} · window ${report.window.days} days</text>
  <text x="40" y="96" font-size="15" font-weight="700" fill="#111">Narrative-to-token conversion</text>
  ${conversionRows}
  ${empty}
  <line x1="40" y1="360" x2="960" y2="360" stroke="#dddddd" stroke-width="1"/>
  <text x="40" y="388" font-size="15" font-weight="700" fill="#111">Evidence coverage</text>
  ${coverageRows}
  <text x="40" y="552" font-size="11" fill="#666">Bridged assets (*.omft.near, *.omdep.near, *.bridge.near) are excluded from the conversion cohort.</text>
  <text x="40" y="572" font-size="11" fill="#666">Generated from Postgres by npm run thesis:report. No value is hardcoded; missing data stays unknown.</text>
  <text x="40" y="592" font-size="11" fill="#666">Early Radar returns are gross observed price returns, not executable PnL.</text>
</svg>`;
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
    console.log('npm run thesis:report -- [--days 7] [--write] [--json]\nRead-only evidence snapshot from the local research database. --write writes THESIS_EVIDENCE.md and THESIS_EVIDENCE.svg.');
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
    const markdown = renderMarkdown(report, values.write);
    if (values.write) {
      await writeFile(OUTPUT, markdown, 'utf8');
      await writeFile('THESIS_EVIDENCE.svg', renderEvidenceSvg(report), 'utf8');
      console.log(`Wrote ${OUTPUT} and THESIS_EVIDENCE.svg`);
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
