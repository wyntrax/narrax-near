import { readFile } from 'node:fs/promises';
import { createPrisma } from '@narra/database';

interface SeedFile {
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** The public seed stores token ids as `tid` to avoid false secret-scanner hits. */
function restoreTid(rows: unknown[]): unknown[] {
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    const { tid, ...rest } = row as Record<string, unknown>;
    return { ...rest, tokenId: tid };
  });
}

/**
 * Loads the read-only research snapshot into a demo database. This is destructive for the research
 * tables, so it requires an explicit confirmation. Never point it at a production database.
 *
 *   DEMO_SEED_CONFIRM=yes npm run demo:seed
 */
async function main() {
  if (process.env.DEMO_SEED_CONFIRM !== 'yes') {
    throw new Error('Refusing to seed. Set DEMO_SEED_CONFIRM=yes and point DATABASE_URL at a demo database.');
  }
  const seed = JSON.parse(await readFile('demo/seed.json', 'utf8')) as SeedFile;
  const tables = seed.tables;
  const count = (name: string) => Array.isArray(tables[name]) ? tables[name]!.length : 0;

  const db = createPrisma();
  try {
    await db.$transaction(async tx => {
      // Reverse dependency order. User-owned alerts are left alone.
      // Smart-money and systemSetting tables are only replaced when present in the seed file.
      if (count('smartWallet') || count('smartWalletProfile') || count('smartWalletTrade')) {
        await tx.smartWalletTrade.deleteMany();
        await tx.smartWalletProfile.deleteMany();
        await tx.smartWallet.deleteMany();
      }
      await tx.opportunity.deleteMany();
      await tx.narrativeTokenRelation.deleteMany();
      await tx.tokenRiskMetric.deleteMany();
      await tx.tokenHolderMetric.deleteMany();
      await tx.tokenMetric.deleteMany();
      await tx.token.deleteMany();
      await tx.narrativeMetric.deleteMany();
      await tx.narrative.deleteMany();
      await tx.alert.deleteMany({ where: { userId: null } });
      if (count('systemSetting')) {
        await tx.systemSetting.deleteMany({
          where: {
            OR: [
              { key: { startsWith: 'research.market.' } },
              { key: 'research.smartMoney.health' },
              { key: 'research.smartMoney.publicSummary' },
            ],
          },
        });
      }

      // Dependency order.
      if (count('narrative')) await tx.narrative.createMany({ data: tables.narrative as never });
      if (count('narrativeMetric')) await tx.narrativeMetric.createMany({ data: tables.narrativeMetric as never });
      if (count('token')) await tx.token.createMany({ data: tables.token as never });
      if (count('tokenMetric')) await tx.tokenMetric.createMany({ data: restoreTid(tables.tokenMetric!) as never });
      if (count('tokenHolderMetric')) await tx.tokenHolderMetric.createMany({ data: restoreTid(tables.tokenHolderMetric!) as never });
      if (count('tokenRiskMetric')) await tx.tokenRiskMetric.createMany({ data: restoreTid(tables.tokenRiskMetric!) as never });
      if (count('narrativeTokenRelation')) await tx.narrativeTokenRelation.createMany({ data: restoreTid(tables.narrativeTokenRelation!) as never });
      if (count('opportunity')) await tx.opportunity.createMany({ data: restoreTid(tables.opportunity!) as never });
      if (count('alert')) await tx.alert.createMany({ data: tables.alert as never });
      if (count('smartWallet')) await tx.smartWallet.createMany({ data: tables.smartWallet as never });
      if (count('smartWalletProfile')) await tx.smartWalletProfile.createMany({ data: tables.smartWalletProfile as never });
      if (count('smartWalletTrade')) await tx.smartWalletTrade.createMany({ data: tables.smartWalletTrade as never });
      if (count('systemSetting')) await tx.systemSetting.createMany({ data: tables.systemSetting as never });
    }, { timeout: 60_000, maxWait: 10_000 });

    console.log(`Seeded demo data from ${seed.exportedAt}`);
    for (const name of ['narrative', 'token', 'tokenMetric', 'tokenHolderMetric', 'tokenRiskMetric', 'opportunity', 'alert']) {
      console.log(`${name}: ${count(name)}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
