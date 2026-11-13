import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@narra/database';
import { buildApp } from './app';

function fakeDb() {
  return {
    narrative: { findMany: async () => [], count: async () => 0 },
    token: { count: async () => 0, findMany: async () => [], findUnique: async () => null },
    opportunity: { count: async () => 0 },
    alert: { count: async () => 0 },
  } as unknown as PrismaClient;
}

describe('public-only judge API', () => {
  it('serves health, the landing snapshot, the thesis desk and the risk gate without auth dependencies', async () => {
    const app = await buildApp({ publicDb: fakeDb(), publicOnly: true });
    try {
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({ status: 'ok' });

      const snapshot = await app.inject({ method: 'GET', url: '/v1/public-research-snapshot' });
      expect(snapshot.statusCode).toBe(200);
      expect(snapshot.json()).toMatchObject({ activeNarratives: 0, tokensObserved: 0 });

      const thesis = await app.inject({ method: 'GET', url: '/v1/public-thesis-desk' });
      expect(thesis.statusCode).toBe(200);
      expect(thesis.json()).toMatchObject({ funnel: { activeNarratives: 0, nativeTokens: 0 } });

      const risk = await app.inject({ method: 'GET', url: '/v1/agent/risk/unknown.near' });
      expect(risk.statusCode).toBe(200);
      expect(risk.json()).toMatchObject({ verdict: 'UNKNOWN', reasons: ['TOKEN_NOT_FOUND'] });
    } finally {
      await app.close();
    }
  });
});
