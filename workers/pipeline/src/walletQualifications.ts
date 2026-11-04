import type { Prisma } from '@narra/database';
import { qualifyWallet } from '@narra/smart-money';

type Db = Pick<Prisma.TransactionClient, 'systemSetting'>;

/** Recomputes wallet research eligibility from current settings; never trusts a stale stored verdict. */
export async function walletQualifications(
  db: Db,
  wallets: { id: string; active: boolean }[],
  now: Date,
) {
  const settings = await db.systemSetting.findMany({
    where: { key: { in: wallets.flatMap(w => [`wallet.research.${w.id}`, `wallet.history.${w.id}`]) } },
  });
  const byKey = new Map(settings.map(s => [s.key, s.value]));
  return new Map(wallets.map(w => [w.id, {
    ...qualifyWallet('APPROVED', w.active, byKey.get(`wallet.research.${w.id}`), byKey.get(`wallet.history.${w.id}`), now),
    sample: byKey.get(`wallet.research.${w.id}`) ?? null,
  }]));
}
