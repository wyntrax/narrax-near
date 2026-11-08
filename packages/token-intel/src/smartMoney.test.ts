import { describe, expect, it } from 'vitest';
import {
  assessSmartWallet, computeSmartWalletStats, SMART_MONEY_RULES, smartWalletScore,
  type SmartTradeRow,
} from './smartMoney';

const start = new Date('2026-11-01T00:00:00.000Z');
const at = (hours: number) => new Date(start.getTime() + hours * 3_600_000);
const trade = (token: string, side: 'BUY' | 'SELL', tokenAmount: number, valueUsd: number, hours: number): SmartTradeRow => ({ token, side, tokenAmount, valueUsd, at: at(hours) });

describe('observed smart-money cost basis', () => {
  it('realizes average-cost PnL on sells and keeps open units out of realized PnL', () => {
    const stats = computeSmartWalletStats([
      trade('token.near', 'BUY', 100, 100, 0),
      trade('token.near', 'SELL', 50, 100, 1),
      trade('token.near', 'SELL', 50, 25, 2),
    ]);
    expect(stats).toMatchObject({
      tradeCount: 3, buyCount: 1, sellCount: 2, tokensTraded: 1, closedTokens: 1,
      totalBoughtUsd: 100, buyVolumeUsd: 100, sellVolumeUsd: 125,
      pnlUsd: 25, winRate: 0.5, medianRoi: 0.25, unmatchedSells: 0, excessSellUnits: 0,
    });
    expect(stats.legs).toHaveLength(2);
    expect(stats.legs[0]).toMatchObject({ pnlUsd: 50, costUsd: 50, roi: 1 });
    expect(stats.legs[1]).toMatchObject({ pnlUsd: -25, costUsd: 50, roi: -0.5 });
  });

  it('excludes sells whose buy was not observed and flags oversized sells', () => {
    const unmatched = computeSmartWalletStats([trade('token.near', 'SELL', 10, 10, 0)]);
    expect(unmatched.legs).toHaveLength(0);
    expect(unmatched.unmatchedSells).toBe(1);
    expect(unmatched.pnlUsd).toBe(0);

    const excess = computeSmartWalletStats([
      trade('token.near', 'BUY', 10, 10, 0),
      trade('token.near', 'SELL', 20, 30, 1),
    ]);
    expect(excess.excessSellUnits).toBe(1);
    expect(excess.legs).toHaveLength(1);
    expect(excess.legs[0]).toMatchObject({ pnlUsd: 5, costUsd: 10, roi: 0.5 });
  });

  it('does not score a wallet below five closed legs', () => {
    const stats = computeSmartWalletStats([
      trade('a.near', 'BUY', 10, 10, 0), trade('a.near', 'SELL', 10, 20, 1),
      trade('b.near', 'BUY', 10, 10, 2), trade('b.near', 'SELL', 10, 20, 3),
    ]);
    expect(smartWalletScore(stats)).toBeNull();
  });
});

describe('smart-money admission', () => {
  const sample = () => computeSmartWalletStats([
    ...Array.from({ length: 20 }, (_, i) => trade(`token${i % 5}.near`, 'BUY', 10, 10, i * 2)),
    ...Array.from({ length: 20 }, (_, i) => trade(`token${i % 5}.near`, 'SELL', 10, 20, i * 2 + 1)),
    trade('token0.near', 'BUY', 1, 1, 42),
    trade('token1.near', 'BUY', 1, 1, 49),
  ]);

  it('qualifies only a complete, positive sample with enough history and score', () => {
    const stats = sample();
    const score = smartWalletScore(stats);
    expect(score).not.toBeNull();
    expect(assessSmartWallet(stats, score).status).toBe('QUALIFIED');
  });

  it('keeps a short or incomplete sample insufficient and a losing complete sample provisional', () => {
    const short = computeSmartWalletStats([
      trade('token.near', 'BUY', 10, 10, 0), trade('token.near', 'SELL', 10, 20, 1),
    ]);
    expect(assessSmartWallet(short, smartWalletScore(short)).status).toBe('INSUFFICIENT');
    expect(assessSmartWallet(short, null).reasons).toContain('TOO_FEW_CLOSED_TRADES');

    const stats = sample();
    const provisional = assessSmartWallet({ ...stats, medianRoi: -0.1 }, 80);
    expect(provisional.status).toBe('PROVISIONAL');
    expect(provisional.reasons).toContain('NEGATIVE_MEDIAN_ROI');
    expect(SMART_MONEY_RULES.minObservedHours).toBe(24);
  });
});
