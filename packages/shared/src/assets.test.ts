import { describe, expect, it } from 'vitest';
import { isBridgedAsset } from './assets';

describe('bridged asset detection', () => {
  it.each([
    'arb.omft.near',
    'prl.omft.near',
    'eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
    'sol-0x936420c6ae310eb29511d139991654f922456fbe.omdep.near',
    'nbtc.bridge.near',
    'nbtc.bridge.testnet',
    'wrap.omft.testnet',
  ])('treats %s as a bridged asset', mint => {
    expect(isBridgedAsset(mint)).toBe(true);
  });

  it.each([
    'nearly-993927.nearlytrade.near',
    'alexchad.v2-launchpad.justhoot.near',
    'cnear.assetize.near',
    'wrap.near',
    '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
    'not-an-account',
    'foo.omftx.near',
    'foo.omft.near.evil',
  ])('does not treat %s as a bridged asset', mint => {
    expect(isBridgedAsset(mint)).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    expect(isBridgedAsset('  nbtc.bridge.near  ')).toBe(true);
  });
});
