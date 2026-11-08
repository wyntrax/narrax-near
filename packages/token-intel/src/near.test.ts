import { describe, expect, it } from 'vitest';
import { EARLY_RULES, evaluateEarlyBoth } from './earlyRadar';
import { MIN_HOLDERS, MIN_LIQUIDITY_USD, meetsFloors, opportunityScore } from './opportunity';

const inputs = {
  marketCapUsd: 40_000, liquidityUsd: 20_000, volume24hUsd: 30_000, holders: 500, holdersThen: 400,
  top10Pct: 30, tokenAgeMinutes: 3_600, relation: 'OG' as const, ogScore: 85,
  narrativeScore: 80, narrativeStage: 'EMERGING', narrativeManipulationRisk: 20,
  divergence: 'POSITIVE' as const, priceGrowth1hPct: 8, riskFlags: [] as string[],
};

describe('NEAR early radar', () => {
  it('scores a healthy token for both profiles without developer or wallet inputs', () => {
    const both = evaluateEarlyBoth(inputs);
    expect(both.trencher.eligible).toBe(true);
    expect(both.holder.eligible).toBe(true);
    expect(both.trencher.score).toBeGreaterThan(0);
    expect(both.holder.score).toBeGreaterThan(0);
  });
  it('fails closed when holders or concentration are unknown', () => {
    const both = evaluateEarlyBoth({ ...inputs, holders: null, top10Pct: null });
    expect(both.trencher.eligible).toBe(false);
    expect(both.trencher.reasons).toEqual(expect.arrayContaining(['HOLDERS_UNKNOWN', 'CONCENTRATION_UNKNOWN']));
  });
  it('excludes a dead narrative and tokens above the early ceiling', () => {
    expect(evaluateEarlyBoth({ ...inputs, narrativeStage: 'DEAD' }).trencher.eligible).toBe(false);
    expect(evaluateEarlyBoth({ ...inputs, marketCapUsd: EARLY_RULES.maxMarketCapUsd }).trencher.eligible).toBe(false);
  });
});

describe('opportunity scoring', () => {
  it('requires holders and liquidity before ranking', () => {
    expect(meetsFloors({ liquidityUsd: MIN_LIQUIDITY_USD, holders: MIN_HOLDERS, relation: 'OG' })).toBe(true);
    expect(meetsFloors({ liquidityUsd: MIN_LIQUIDITY_USD - 1, holders: MIN_HOLDERS, relation: 'OG' })).toBe(false);
    expect(meetsFloors({ liquidityUsd: MIN_LIQUIDITY_USD, holders: MIN_HOLDERS, relation: 'SUSPICIOUS' })).toBe(false);
  });
  it('caps a thin, suspicious token and returns every component', () => {
    const s = opportunityScore({ narrativeScore: 100, liquidityUsd: 1_000, holders: 100, priceGrowth1hPct: 100, ogScore: 100, relation: 'SUSPICIOUS', divergence: 'STRONG_POSITIVE', top10Pct: 90, tokenAgeMinutes: 1, narrativeManipulationRisk: 90 });
    expect(s.score).toBeLessThanOrEqual(40);
    expect(s.caps).toEqual(expect.arrayContaining(['SUSPICIOUS_TOKEN']));
    expect(s.risk).toBeGreaterThan(50);
  });
  it('does not turn missing growth into a positive signal', () => {
    const s = opportunityScore({ narrativeScore: 50, liquidityUsd: 100_000, holders: 500, priceGrowth1hPct: null, ogScore: 50, relation: 'PRIMARY', divergence: 'UNKNOWN', top10Pct: null, tokenAgeMinutes: null, narrativeManipulationRisk: null });
    expect(s.momentum).toBe(50);
    expect(s.risk).toBeGreaterThan(0);
  });
});
