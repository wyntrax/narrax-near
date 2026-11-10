import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@narra/database';
import { registerAgentRiskRoutes } from './agentRisk';

const NOW = new Date('2026-11-10T12:00:00Z');

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    mint: 'token.near',
    symbol: 'TOKEN',
    name: 'Token',
    blacklisted: false,
    metrics: [{
      priceUsd: 0.1, marketCapUsd: 100_000, liquidityUsd: 50_000, volume24hUsd: 10_000,
      at: new Date('2026-11-10T11:59:00Z'),
    }],
    holders: [{ holders: 120, top10Pct: 25, at: new Date('2026-11-10T11:55:00Z') }],
    risk: [{ riskScore: 42, flags: ['THIN_LIQUIDITY'], at: new Date('2026-11-10T11:55:00Z') }],
    ...overrides,
  };
}

async function get(url: string, row: unknown = tokenRow()) {
  const app = Fastify();
  const db = { token: { findUnique: async () => row } } as unknown as PrismaClient;
  registerAgentRiskRoutes(app, { db, now: () => NOW });
  const response = await app.inject({ method: 'GET', url });
  await app.close();
  return response;
}

describe('agent risk gate', () => {
  it('passes only fresh, known, below-threshold evidence', async () => {
    const response = await get('/v1/agent/risk/token.near');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      mint: 'token.near', symbol: 'TOKEN', verdict: 'PASS', riskScore: 42,
      flags: ['THIN_LIQUIDITY'], fresh: true, reasons: [],
      holders: { count: 120, top10Pct: 25 },
      policy: { maxRiskScore: 80, metricMaxAgeMs: 900_000, evidenceMaxAgeMs: 3_600_000 },
    });
  });

  it('blocks a blacklisted token even when its evidence is fresh', async () => {
    const response = await get('/v1/agent/risk/token.near', tokenRow({ blacklisted: true }));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ verdict: 'BLOCK', reasons: ['BLACKLISTED'] });
  });

  it('blocks a risk score at or above the critical threshold', async () => {
    const response = await get('/v1/agent/risk/token.near', tokenRow({
      risk: [{ riskScore: 85, flags: ['TOP10_OVER_60', 'THIN_LIQUIDITY'], at: new Date('2026-11-10T11:55:00Z') }],
    }));
    expect(response.json()).toMatchObject({ verdict: 'BLOCK', riskScore: 85, reasons: ['RISK_SCORE_ABOVE_80'] });
  });

  it('returns UNKNOWN for an unknown token instead of guessing', async () => {
    const response = await get('/v1/agent/risk/unknown.near', null);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ mint: 'unknown.near', verdict: 'UNKNOWN', fresh: false, reasons: ['TOKEN_NOT_FOUND'] });
  });

  it('returns UNKNOWN when market evidence is stale', async () => {
    const response = await get('/v1/agent/risk/token.near', tokenRow({
      metrics: [{
        priceUsd: 0.1, marketCapUsd: 100_000, liquidityUsd: 50_000, volume24hUsd: 10_000,
        at: new Date('2026-11-10T11:30:00Z'),
      }],
    }));
    expect(response.json()).toMatchObject({ verdict: 'UNKNOWN', fresh: false, reasons: ['STALE_MARKET_DATA'] });
  });

  it('returns UNKNOWN when holder evidence is missing', async () => {
    const response = await get('/v1/agent/risk/token.near', tokenRow({ holders: [] }));
    expect(response.json()).toMatchObject({ verdict: 'UNKNOWN', fresh: false, reasons: ['HOLDER_DATA_UNAVAILABLE'] });
  });

  it('rejects a string that cannot be a NEAR account id', async () => {
    const response = await get('/v1/agent/risk/not%20an%20account');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'INVALID_MINT' });
  });
});
