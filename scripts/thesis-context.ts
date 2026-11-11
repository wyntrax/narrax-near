import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { NearRpc } from '@narra/near';

/**
 * Builds a small, keyless NEAR macro context from public data. It does not read the database and
 * does not claim that narrative attention predicts NEAR price. The report separates the slow macro
 * clock from the fast narrative/token clock used by the research workspace.
 *
 *   npm run thesis:context -- --write
 */

const DAY = 86_400_000;
const OUTPUT_MD = 'THESIS_CONTEXT.md';
const OUTPUT_SVG = 'THESIS_CONTEXT.svg';

interface Point { at: Date; value: number }
interface Series { name: string; points: Point[]; color: string; dash?: string }

const fmt = (value: number | null | undefined, digits = 0): string =>
  value == null ? 'unknown' : value.toLocaleString('en-US', { maximumFractionDigits: digits });
const usd = (value: number | null | undefined): string => value == null ? 'unknown' : `$${fmt(value, 2)}`;
const compact = (value: number | null | undefined): string => value == null ? 'unknown' : `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}`;
const pct = (value: number | null | undefined): string => value == null ? 'unknown' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const numberOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function getJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { accept: 'application/json', ...(init?.headers ?? {}) } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSeries(raw: unknown, key: 'tvl' | 'stable' | 'price' | 'marketCap'): Point[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<string, Point>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    let at: Date;
    let value: number | null = null;
    if (key === 'tvl') {
      const date = Number(item.date);
      at = new Date(date * 1000);
      value = Number(item.tvl);
    } else if (key === 'stable') {
      const date = Number(item.date);
      at = new Date(date * 1000);
      const circulating = item.totalCirculatingUSD as Record<string, unknown> | undefined;
      value = circulating ? Number(circulating.peggedUSD) : null;
    } else {
      const pair = item as unknown as [number, number];
      at = new Date(Number(pair[0]));
      value = Number(pair[1]);
    }
    if (!Number.isFinite(+at) || value == null || !Number.isFinite(value) || value <= 0) continue;
    const day = at.toISOString().slice(0, 10);
    byDay.set(day, { at: new Date(`${day}T00:00:00Z`), value });
  }
  return [...byDay.values()].sort((a, b) => +a.at - +b.at);
}

function valueAt(points: Point[], daysAgo: number, now: Date): number | null {
  if (!points.length) return null;
  const target = +now - daysAgo * DAY;
  let best: Point | null = null;
  for (const point of points) {
    if (+point.at <= target) best = point;
    else break;
  }
  if (best) return best.value;
  // The first observation can be a few days after the target (for example a 365-day chart that
  // starts at midnight UTC). Use it rather than reporting a missing long-horizon change.
  return +points[0]!.at <= target + 3 * DAY ? points[0]!.value : null;
}

function changePct(latest: number | null, past: number | null): number | null {
  return latest != null && past != null && past > 0 ? (latest / past - 1) * 100 : null;
}

function seriesSvg(series: Series[], width: number, height: number): string {
  const visible = series.filter(item => item.points.length > 1);
  if (!visible.length) return '';
  const normalized = visible.map(item => {
    const base = item.points[0]!.value;
    return { ...item, points: item.points.map(point => ({ at: point.at, value: (point.value / base) * 100 })) };
  });
  const allValues = normalized.flatMap(item => item.points.map(point => point.value));
  const min = Math.min(100, ...allValues);
  const max = Math.max(100, ...allValues);
  const pad = Math.max(2, (max - min) * 0.08);
  const lo = min - pad, hi = max + pad;
  const x0 = 80, x1 = width - 40, y0 = 140, y1 = height - 60;
  const x = (at: Date, start: number, end: number) => x0 + ((+at - start) / Math.max(1, end - start)) * (x1 - x0);
  const y = (value: number) => y1 - ((value - lo) / Math.max(1, hi - lo)) * (y1 - y0);
  const start = Math.min(...normalized.flatMap(item => item.points.map(point => +point.at)));
  const end = Math.max(...normalized.flatMap(item => item.points.map(point => +point.at)));
  const lines = normalized.map(item => {
    const points = item.points.map(point => `${x(point.at, start, end).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
    return `<polyline fill="none" stroke="${item.color}" stroke-width="2.5"${item.dash ? ` stroke-dasharray="${item.dash}"` : ''} points="${points}"/>`;
  }).join('\n');
  const legend = normalized.map((item, index) => `<rect x="${80 + index * 210}" y="100" width="12" height="12" fill="${item.color}" rx="2"/><text x="${98 + index * 210}" y="111" font-size="12" fill="#111">${item.name}</text>`).join('\n');
  return `<line x1="${x0}" y1="${y(100).toFixed(1)}" x2="${x1}" y2="${y(100).toFixed(1)}" stroke="#dddddd" stroke-width="1"/>
  <text x="40" y="${y(100).toFixed(1)}" font-size="10" fill="#777" text-anchor="end">100</text>
  ${lines}
  ${legend}
  <text x="${x0}" y="${height - 30}" font-size="10" fill="#666">${new Date(start).toISOString().slice(0, 10)}</text>
  <text x="${x1}" y="${height - 30}" font-size="10" fill="#666" text-anchor="end">${new Date(end).toISOString().slice(0, 10)}</text>`;
}

async function main() {
  const { values } = parseArgs({ options: {
    write: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('npm run thesis:context -- [--write]\nFetches public NEAR macro data (DefiLlama, CoinGecko, NearBlocks, NEAR RPC). --write writes THESIS_CONTEXT.md and THESIS_CONTEXT.svg.');
    return;
  }

  const [tvlRaw, stableRaw, coingeckoRaw, nearBlocksRaw] = await Promise.all([
    getJson('https://api.llama.fi/v2/historicalChainTvl/NEAR'),
    getJson('https://stablecoins.llama.fi/stablecoincharts/NEAR'),
    getJson('https://api.coingecko.com/api/v3/coins/near/market_chart?vs_currency=usd&days=365&interval=daily'),
    getJson('https://api.nearblocks.io/v1/stats'),
  ]);
  const coingecko = coingeckoRaw as { prices?: unknown; market_caps?: unknown } | null;
  const series: Series[] = [
    { name: 'NEAR TVL', points: normalizeSeries(tvlRaw, 'tvl'), color: '#111111' },
    { name: 'Stablecoin supply', points: normalizeSeries(stableRaw, 'stable'), color: '#777777' },
    { name: 'NEAR price', points: normalizeSeries(coingecko?.prices, 'price'), color: '#111111', dash: '6 4' },
    { name: 'NEAR market cap', points: normalizeSeries(coingecko?.market_caps, 'marketCap'), color: '#999999', dash: '2 3' },
  ];
  const nearStats = (nearBlocksRaw as { stats?: Array<Record<string, unknown>> } | null)?.stats?.[0] ?? null;
  const block = await new NearRpc({ url: 'https://rpc.mainnet.near.org', timeoutMs: 20_000 }).latestBlock().catch(() => null);
  const now = new Date();
  const latest = (name: string) => series.find(item => item.name === name)?.points.at(-1)?.value ?? null;
  const tvlLatest = latest('NEAR TVL');
  const stableLatest = latest('Stablecoin supply');
  const priceLatest = latest('NEAR price');
  const capLatest = latest('NEAR market cap');

  const rows = [
    ['NEAR TVL', usd(tvlLatest), tvlLatest, 'NEAR TVL'],
    ['Stablecoin supply', usd(stableLatest), stableLatest, 'Stablecoin supply'],
    ['NEAR price', priceLatest == null ? 'unknown' : `$${priceLatest.toFixed(2)}`, priceLatest, 'NEAR price'],
    ['NEAR market cap', compact(capLatest), capLatest, 'NEAR market cap'],
  ].map(([label, display, value, seriesName]) => {
    const points = series.find(item => item.name === seriesName)?.points ?? [];
    const v = Number(value);
    return `| ${label} | ${display} | ${pct(changePct(Number.isFinite(v) ? v : null, valueAt(points, 30, now)))} | ${pct(changePct(Number.isFinite(v) ? v : null, valueAt(points, 90, now)))} | ${pct(changePct(Number.isFinite(v) ? v : null, valueAt(points, 365, now)))} |`;
  });

  const lines = [
    '# NARRAX — NEAR macro context',
    '',
    `Generated: ${now.toISOString()}`,
    '',
    'This is a keyless public-data snapshot. It is the slow macro clock, not a price prediction and not the token-level conversion evidence in [`THESIS_EVIDENCE.md`](./THESIS_EVIDENCE.md).',
    '',
    '![NEAR macro context](./THESIS_CONTEXT.svg)',
    '',
    '## Snapshot',
    '',
    '| Metric | Latest | 30d change | 90d change | 365d change |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    `| Nodes online | ${fmt(numberOrNull(nearStats?.nodes_online))} | — | — | — |`,
    `| Gas price (yoctoNEAR) | ${fmt(numberOrNull(nearStats?.gas_price))} | — | — | — |`,
    `| Latest final block | ${block ? fmt(block.height) : 'unknown'} | — | — | — |`,
    '',
    'Sources: DefiLlama chain TVL and stablecoin charts, CoinGecko market chart, NearBlocks stats, NEAR mainnet RPC. All public and keyless.',
    '',
    '## How this fits the thesis',
    '',
    'NEAR macro fundamentals and narrative attention move on different clocks. TVL, stablecoin supply, price and market cap are slow, network-level series. Narrative attention and token-level liquidity/holders move much faster, and most of that movement never becomes durable adoption.',
    '',
    'NARRAX tests the conversion, not the price: does attention become liquidity, distributed ownership and observed trade flow? This macro context is the backdrop, not the answer. It does not claim that narrative attention predicts NEAR price.',
    '',
    '## What this does not prove',
    '',
    '- It does not establish causality between narrative attention and NEAR price.',
    '- It does not reconstruct historical narrative attention; NARRAX collection starts when the pipeline starts.',
    '- It does not measure active accounts, transaction counts or NEAR Intents volume; those need BigQuery or a partner JWT and are left unknown rather than estimated.',
    '- A rising macro series does not validate any individual token thesis.',
    '',
  ];

  const markdown = lines.join('\n');
  if (values.write) {
    const chartSeries = series
      .filter(item => item.name !== 'NEAR market cap')
      .map(item => ({ ...item, points: item.points.filter(point => +point.at >= +now - 365 * DAY) }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" role="img" aria-label="NEAR macro context" font-family="Arial, Helvetica, sans-serif">
  <rect width="1000" height="500" fill="#ffffff"/>
  <text x="40" y="42" font-size="22" font-weight="700" fill="#111">NEAR macro context</text>
  <text x="40" y="66" font-size="12" fill="#666">Last 365 days, indexed to 100 at first observation · generated ${now.toISOString()}</text>
  ${seriesSvg(chartSeries, 1000, 500)}
  <text x="40" y="490" font-size="10" fill="#666">DefiLlama · CoinGecko · NearBlocks · NEAR RPC. Macro context only; not a price prediction.</text>
</svg>`;
    await writeFile(OUTPUT_MD, markdown, 'utf8');
    await writeFile(OUTPUT_SVG, svg, 'utf8');
    console.log(`Wrote ${OUTPUT_MD} and ${OUTPUT_SVG}`);
  } else {
    console.log(markdown);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
