import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@narra/database';
import { registerPublicThesisDesk } from './publicThesisDesk';

const NOW = new Date('2026-11-11T12:00:00Z');

describe('public thesis desk', () => {
  it('excludes bridged assets, computes the honest conversion funnel, and ranks floor-passing tokens first', async () => {
    const db = {
      narrative: {
        findMany: async () => [
          {
            slug: 'near',
            name: 'Near',
            stage: 'EMERGING',
            score: 72,
            velocity: 4.5,
            firstDetectedAt: new Date('2026-11-08T10:00:00Z'),
            metrics: [{ at: new Date('2026-11-11T11:30:00Z'), organicScore: 81, manipulationRisk: 14 }],
            tokens: [
              { token: { mint: 'nearly-993927.nearlytrade.near' } },
              { token: { mint: 'eth.omft.near' } },
            ],
          },
        ],
      },
      token: {
        findMany: async () => [
          {
            mint: 'eth.omft.near',
            symbol: 'ETH',
            name: 'Bridged ETH',
            metrics: [{ priceUsd: 3000, marketCapUsd: 10_000_000, liquidityUsd: 900_000, volume24hUsd: 200_000, at: NOW }],
            holders: [{ holders: 5000, top10Pct: 12, at: NOW }],
            risk: [{ riskScore: 0, flags: [], at: NOW }],
            narratives: [],
          },
          {
            mint: 'thin.v2-launchpad.justhoot.near',
            symbol: 'THIN',
            name: 'Thin Token',
            metrics: [{ priceUsd: 0.01, marketCapUsd: 10_000, liquidityUsd: 4_000, volume24hUsd: 500, at: NOW }],
            holders: [],
            risk: [{ riskScore: 30, flags: ['THIN_LIQUIDITY', 'HOLDERS_UNKNOWN'], at: NOW }],
            narratives: [],
          },
          {
            mint: 'stale.near',
            symbol: 'STALE',
            name: 'Stale Token',
            metrics: [{ priceUsd: 1, marketCapUsd: 1_000_000, liquidityUsd: 100_000, volume24hUsd: 5_000, at: new Date('2026-11-11T09:00:00Z') }],
            holders: [{ holders: 100, top10Pct: 10, at: new Date('2026-11-11T09:00:00Z') }],
            risk: [{ riskScore: 10, flags: [], at: new Date('2026-11-11T09:00:00Z') }],
            narratives: [],
          },
          {
            mint: 'nearly-993927.nearlytrade.near',
            symbol: 'NEARLY',
            name: 'NEARLY',
            metrics: [{ priceUsd: 0.0006, marketCapUsd: 600_000, liquidityUsd: 116_000, volume24hUsd: 20_000, at: NOW }],
            holders: [{ holders: 2680, top10Pct: 19.1, at: NOW }],
            risk: [{ riskScore: 0, flags: [], at: NOW }],
            narratives: [
              {
                relation: 'OG',
                ogScore: 84,
                matchScore: 95,
                confidence: 0.9,
                narrative: { slug: 'near', name: 'Near', stage: 'EMERGING' },
              },
            ],
          },
        ],
      },
      opportunity: { count: async () => 1 },
    } as unknown as PrismaClient;

    const app = Fastify();
    registerPublicThesisDesk(app, db, () => NOW);
    try {
      const response = await app.inject({ method: 'GET', url: '/v1/public-thesis-desk' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=30');
      const body = response.json();
      expect(body.funnel).toEqual({
        activeNarratives: 1,
        catalogTokens: 4,
        bridgedExcluded: 1,
        nativeTokens: 3,
        narrativeLinkedTokens: 1,
        holderCoveredTokens: 2,
        floorPassingTokens: 1,
        opportunities24h: 1,
      });
      expect(body.narratives[0]).toMatchObject({ slug: 'near', linkedTokenCount: 1, organicScore: 81, fresh: true });
      expect(body.tokens.map((t: { mint: string }) => t.mint)).toEqual([
        'nearly-993927.nearlytrade.near',
        'stale.near',
        'thin.v2-launchpad.justhoot.near',
      ]);
      expect(body.tokens[0].passesFloors).toBe(true);
      expect(body.tokens[0].freshness).toBe('FRESH');
      expect(body.tokens[1]).toMatchObject({ passesFloors: false, freshness: 'STALE', marketFresh: false, holdersFresh: false });
      expect(body.tokens[2].passesFloors).toBe(false);
      expect(body.tokens[2].freshness).toBe('STALE');
    } finally {
      await app.close();
    }
  });
});
