import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@narra/database';
import { registerPublicResearchSnapshot } from './publicResearchSnapshot';

function fakeDb() {
  let narrativeCalls = 0;
  const db = {
    narrative: {
      findMany: async () => {
        narrativeCalls++;
        return [
          { score: 80, metrics: [{ at: new Date('2026-11-08T10:00:00Z') }] },
          { score: 60, metrics: [{ at: new Date('2026-11-08T11:00:00Z') }] },
        ];
      },
      count: async () => 7,
    },
    token: { count: async () => 42 },
    opportunity: { count: async () => 9 },
    alert: { count: async () => 3 },
  } as unknown as PrismaClient;
  return { db, calls: () => narrativeCalls };
}

describe('public research snapshot', () => {
  it('returns aggregate NEAR research counts and caches them for 30 seconds', async () => {
    const app = Fastify();
    const { db, calls } = fakeDb();
    let now = new Date('2026-11-08T12:00:00Z');
    registerPublicResearchSnapshot(app, db, () => now);
    const first = await app.inject({ method: 'GET', url: '/v1/public-research-snapshot' });
    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toBe('public, max-age=30');
    expect(first.json()).toEqual({
      at: '2026-11-08T12:00:00.000Z', narrativeHeat: 70, narrativeSampleSize: 2,
      narrativeAsOf: '2026-11-08T10:00:00.000Z', activeNarratives: 7, tokensObserved: 42,
      opportunities24h: 9, earlyRadar24h: 3,
    });
    now = new Date('2026-11-08T12:00:10Z');
    const second = await app.inject({ method: 'GET', url: '/v1/public-research-snapshot' });
    expect(second.statusCode).toBe(200);
    expect(calls()).toBe(1);
    now = new Date('2026-11-08T12:00:31Z');
    await app.inject({ method: 'GET', url: '/v1/public-research-snapshot' });
    expect(calls()).toBe(2);
    await app.close();
  });
});
