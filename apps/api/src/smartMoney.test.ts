import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@narra/database';
import { registerSmartMoneyRoutes } from './smartMoney';

const NOW = new Date('2026-11-14T08:00:00Z');
const USER_ID = 'user-1';
const verifier = { verify: async () => ({ privyUserId: 'did:privy:test' }) };

const savedAggregate = {
  trackedWallets: 213,
  qualifiedWallets: 0,
  provisionalWallets: 0,
  insufficientWallets: 213,
  observedTrades: 2049,
  volumeUsd: 306039.2,
  observedFrom: '2026-11-13T00:00:00.000Z',
  lastTradeAt: '2026-11-14T02:41:44.000Z',
  flows: [
    {
      mint: 'token.near',
      symbol: 'TKN',
      name: 'Token',
      netFlowUsd: 600,
      buyVolumeUsd: 900,
      sellVolumeUsd: 300,
      buys: 12,
      sells: 4,
      walletCount: 5,
      lastTradeAt: '2026-11-14T02:41:44.000Z',
    },
  ],
};

const base = {
  user: { findUnique: async () => ({ id: USER_ID, email: null }) },
};

const observedProfile = {
  walletId: 'w1',
  updatedAt: NOW,
  tradeCount: 12,
  buyCount: 7,
  sellCount: 5,
  volumeUsd: 1250.5,
  totalBoughtUsd: 700,
  realizedPnlUsd: 42.25,
  closedTrades: 5,
  closedTokens: 2,
  winningTrades: 3,
  losingTrades: 2,
  winRate: 0.6,
  medianRoi: 0.12,
  profitFactor: 1.8,
  maxDrawdown: 0.04,
  score: 67.2,
  status: 'QUALIFIED',
  eligible: true,
  reasons: [],
  unmatchedSells: 0,
  excessSellUnits: 0,
  observedFrom: NOW,
  observedTo: NOW,
  wallet: { address: 'alice.near', firstSeenAt: NOW, lastTradeAt: NOW },
};

describe('smart money wallet route', () => {
  it('falls back to the saved anonymized aggregate when raw wallet tables are empty', async () => {
    const db = {
      ...base,
      smartWalletProfile: { findMany: async () => [], count: async () => 0 },
      smartWalletTrade: {
        count: async () => 0,
        findFirst: async () => null,
        aggregate: async () => ({ _sum: { valueUsd: null } }),
        findMany: async () => [],
      },
      systemSetting: { findUnique: async () => ({ value: savedAggregate }) },
    } as unknown as PrismaClient;

    const app = Fastify();
    registerSmartMoneyRoutes(app, { db, verifier, now: () => NOW });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/smart-money/wallets',
        headers: { authorization: 'Bearer test' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.source).toBe('AGGREGATE');
      expect(body.items).toEqual([]);
      expect(body.aggregate).toMatchObject({
        trackedWallets: 213,
        qualifiedWallets: 0,
        provisionalWallets: 0,
        insufficientWallets: 213,
        observedTrades: 2049,
        volumeUsd: 306039.2,
      });
      expect(body.aggregate.flows[0]).toMatchObject({ mint: 'token.near', netFlowUsd: 600, walletCount: 5 });
    } finally {
      await app.close();
    }
  });

  it('keeps observed wallet rows and does not attach the aggregate when raw data exists', async () => {
    const db = {
      ...base,
      smartWalletProfile: { findMany: async () => [observedProfile], count: async () => 1 },
      smartWalletTrade: {
        count: async () => 12,
        findFirst: async () => ({ at: NOW }),
        aggregate: async () => ({ _sum: { valueUsd: 1250.5 } }),
        findMany: async () => [],
      },
      systemSetting: { findUnique: async () => ({ value: savedAggregate }) },
    } as unknown as PrismaClient;

    const app = Fastify();
    registerSmartMoneyRoutes(app, { db, verifier, now: () => NOW });
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/smart-money/wallets',
        headers: { authorization: 'Bearer test' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.source).toBe('OBSERVED');
      expect(body.aggregate).toBeNull();
      expect(body.items[0]).toMatchObject({ address: 'alice.near', status: 'QUALIFIED', realizedPnlUsd: 42.25 });
    } finally {
      await app.close();
    }
  });
});
