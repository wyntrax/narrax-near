import { mkdir, writeFile } from 'node:fs/promises';
import { createPrisma } from '@narra/database';

/**
 * Exports the read-only research rows used by the public judge demo. No users, access grants,
 * chats, notifications, private research, keys or provider credentials are exported.
 *
 *   npm run demo:export
 */
async function main() {
  const db = createPrisma();
  try {
    const [
      narrative, narrativeMetric, token, tokenMetric, tokenHolderMetric, tokenRiskMetric,
      narrativeTokenRelation, opportunity, alert, smartWallet, smartWalletProfile, smartWalletTrade,
      systemSetting,
    ] = await Promise.all([
      db.narrative.findMany(),
      db.narrativeMetric.findMany(),
      db.token.findMany(),
      db.tokenMetric.findMany(),
      db.tokenHolderMetric.findMany(),
      db.tokenRiskMetric.findMany(),
      db.narrativeTokenRelation.findMany(),
      db.opportunity.findMany(),
      // Global alerts only. User-owned alerts are not part of the research snapshot.
      db.alert.findMany({ where: { userId: null } }),
      db.smartWallet.findMany(),
      db.smartWalletProfile.findMany(),
      db.smartWalletTrade.findMany(),
      db.systemSetting.findMany({
        where: {
          OR: [
            { key: { startsWith: 'research.market.' } },
            { key: 'research.smartMoney.health' },
          ],
        },
      }),
    ]);

    const tables = {
      narrative, narrativeMetric, token, tokenMetric, tokenHolderMetric, tokenRiskMetric,
      narrativeTokenRelation, opportunity, alert, smartWallet, smartWalletProfile, smartWalletTrade,
      systemSetting,
    };
    const payload = {
      source: 'NARRAX research database snapshot for the public judge demo',
      exportedAt: new Date().toISOString(),
      network: 'mainnet',
      note: 'Read-only research rows only. No users, access grants, chats, notifications or private research.',
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
