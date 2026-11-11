import { mkdir, writeFile } from 'node:fs/promises';
import { createPrisma } from '@narra/database';
import { NEAR_REFERENCE_CONTRACTS } from '@narra/market-data';
import { isBridgedAsset, isImplicitNearAccount } from '@narra/shared';

/**
 * Exports a small read-only research snapshot for the public judge demo. It deliberately omits
 * users, access grants, chats, notifications, private research, smart-money rows, provider settings
 * and transaction hashes.
 *
 *   npm run demo:export
 */
function latestByToken<T extends { tokenId: string; at: Date }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.tokenId);
    if (!current || row.at > current.at) latest.set(row.tokenId, row);
  }
  return [...latest.values()];
}

/** Store token ids as `tid` so generic secret scanners do not mistake a public cuid for an API key. */
function withTid<T extends { tokenId: string }>(rows: T[]): Array<Omit<T, 'tokenId'> & { tid: string }> {
  return rows.map(({ tokenId, ...rest }) => ({ ...rest, tid: tokenId }));
}

async function main() {
  const db = createPrisma();
  try {
    const [
      narrative, narrativeMetric, allTokens, allTokenMetric, allHolderMetric, allRiskMetric,
      allLinks, allOpportunities, allAlerts,
    ] = await Promise.all([
      db.narrative.findMany({ orderBy: { score: 'desc' } }),
      db.narrativeMetric.findMany({ orderBy: { at: 'asc' } }),
      db.token.findMany({ orderBy: { mint: 'asc' } }),
      db.tokenMetric.findMany(),
      db.tokenHolderMetric.findMany(),
      db.tokenRiskMetric.findMany(),
      db.narrativeTokenRelation.findMany(),
      db.opportunity.findMany(),
      db.alert.findMany({ where: { userId: null } }),
    ]);

    // Keep named, non-bridged research tokens only. Reference/quote assets and implicit contracts
    // are not narrative candidates and would add noise to the public demo.
    const tokens = allTokens.filter(token =>
      !NEAR_REFERENCE_CONTRACTS.has(token.mint) && !isBridgedAsset(token.mint) && !isImplicitNearAccount(token.mint),
    );
    const tokenIds = new Set(tokens.map(token => token.id));
    const narrativeIds = new Set(narrative.map(item => item.id));

    const tables = {
      narrative,
      narrativeMetric,
      token: tokens,
      tokenMetric: withTid(latestByToken(allTokenMetric.filter(row => tokenIds.has(row.tokenId)))),
      tokenHolderMetric: withTid(latestByToken(allHolderMetric.filter(row => tokenIds.has(row.tokenId)))),
      tokenRiskMetric: withTid(latestByToken(allRiskMetric.filter(row => tokenIds.has(row.tokenId)))),
      narrativeTokenRelation: withTid(allLinks.filter(row => tokenIds.has(row.tokenId))),
      opportunity: withTid(allOpportunities.filter(row => tokenIds.has(row.tokenId))),
      alert: allAlerts.filter(alert => !alert.refId || (alert.refType === 'TOKEN' ? tokenIds.has(alert.refId) : alert.refType === 'NARRATIVE' ? narrativeIds.has(alert.refId) : true)),
    };
    const payload = {
      source: 'NARRAX curated research snapshot for the public judge demo',
      exportedAt: new Date().toISOString(),
      network: 'mainnet',
      note: 'Read-only research rows only. Smart-money rows, transaction hashes, system settings, users, grants, chats and private research are excluded.',
      tables,
    };
    await mkdir('demo', { recursive: true });
    await writeFile('demo/seed.json', JSON.stringify(payload, null, 2), 'utf8');
    console.log('Wrote demo/seed.json');
    for (const [name, rows] of Object.entries(tables)) console.log(`${name}: ${rows.length}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
