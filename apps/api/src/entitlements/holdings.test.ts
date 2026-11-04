import { describe, expect, it, vi } from 'vitest';
import { baseUnitsFor, createWyntraxHoldings } from './holdings';

const mint = 'So11111111111111111111111111111111111111112';
const tiers = { MEMBER: 500_000, PRO: 1_000_000 };
const DECIMALS = 6;
const memberRaw = 500_000n * 10n ** 6n;
const proRaw = 1_000_000n * 10n ** 6n;

function fakeRpc(balances: Record<string, bigint>, decimals = DECIMALS) {
  const getTokenBaseUnits = vi.fn(async (owner: string) => balances[owner] ?? 0n);
  const getMintInfo = vi.fn(async () => ({ program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', decimals, freezeAuthority: null, mintAuthority: null, hasExtensions: false }));
  return { rpc: { getTokenBaseUnits, getMintInfo }, getTokenBaseUnits, getMintInfo };
}

describe('direct $WYNTRAX holding fallback', () => {
  it('maps the same admin thresholds to MEMBER and PRO using the mint decimals', async () => {
    let at = 1_000_000;
    const { rpc } = fakeRpc({ member: memberRaw, pro: proRaw });
    const holdings = createWyntraxHoldings({ rpc, now: () => at });

    expect(await holdings.tierFor(['member'], { mint, tiers, now: new Date(at) })).toMatchObject({ tier: 'MEMBER', address: 'member' });
    expect(await holdings.tierFor(['pro'], { mint, tiers, now: new Date(at) })).toMatchObject({ tier: 'PRO', address: 'pro' });
    expect(await holdings.tierFor(['none'], { mint, tiers, now: new Date(at) })).toBeNull();
  });

  it('takes the highest tier across linked wallets and deduplicates them', async () => {
    let at = 1_000_000;
    const { rpc, getTokenBaseUnits } = fakeRpc({ low: memberRaw, high: proRaw });
    const holdings = createWyntraxHoldings({ rpc, now: () => at });

    const result = await holdings.tierFor(['low', 'high', 'high', 'low'], { mint, tiers, now: new Date(at) });
    expect(result).toMatchObject({ tier: 'PRO', address: 'high', id: `holding:${mint}:high` });
    expect(getTokenBaseUnits).toHaveBeenCalledTimes(2);
  });

  it('caches the raw balance, so an admin tier change applies without another RPC call', async () => {
    let at = 1_000_000;
    const { rpc, getTokenBaseUnits } = fakeRpc({ holder: 700_000n * 10n ** 6n });
    const holdings = createWyntraxHoldings({ rpc, now: () => at, cacheTtlMs: 60_000 });

    expect((await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) }))?.tier).toBe('MEMBER');
    at += 1_000;
    expect(await holdings.tierFor(['holder'], { mint, tiers: { MEMBER: 600_000, PRO: 650_000 }, now: new Date(at) })).toMatchObject({ tier: 'PRO' });
    expect(getTokenBaseUnits).toHaveBeenCalledTimes(1);

    at += 60_001;
    await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) });
    expect(getTokenBaseUnits).toHaveBeenCalledTimes(2);
  });

  it('caches a failed lookup briefly and never throws', async () => {
    let at = 1_000_000;
    const log = vi.fn();
    const rpc = {
      getMintInfo: vi.fn(async () => ({ decimals: DECIMALS, freezeAuthority: null, mintAuthority: null, hasExtensions: false })),
      getTokenBaseUnits: vi.fn(async () => { throw new Error('rpc down'); }),
    };
    const holdings = createWyntraxHoldings({ rpc, now: () => at, errorTtlMs: 10_000, log });

    expect(await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) })).toBeNull();
    expect(log).toHaveBeenCalledWith({ code: 'WYNTRAX_BALANCE_LOOKUP_FAILED' });
    expect(rpc.getTokenBaseUnits).toHaveBeenCalledTimes(1);

    at += 5_000;
    expect(await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) })).toBeNull();
    expect(rpc.getTokenBaseUnits).toHaveBeenCalledTimes(1);

    at += 10_000;
    await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) });
    expect(rpc.getTokenBaseUnits).toHaveBeenCalledTimes(2);
  });

  it('is disabled without a valid mint or when mint metadata is unavailable', async () => {
    let at = 1_000_000;
    const { rpc, getTokenBaseUnits, getMintInfo } = fakeRpc({ holder: proRaw });
    const holdings = createWyntraxHoldings({ rpc, now: () => at });

    expect(await holdings.tierFor(['holder'], { mint: null, tiers, now: new Date(at) })).toBeNull();
    expect(await holdings.tierFor(['holder'], { mint: 'not-a-mint', tiers, now: new Date(at) })).toBeNull();
    expect(getTokenBaseUnits).not.toHaveBeenCalled();

    getMintInfo.mockRejectedValueOnce(new Error('mint missing'));
    expect(await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) })).toBeNull();
    expect(getTokenBaseUnits).not.toHaveBeenCalled();
  });

  it('fails closed for Token-2022 instead of reading the classic token program', async () => {
    let at = 1_000_000;
    const log = vi.fn();
    const getTokenBaseUnits = vi.fn(async () => proRaw);
    const holdings = createWyntraxHoldings({
      rpc: {
        getMintInfo: async () => ({ program: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', decimals: DECIMALS }),
        getTokenBaseUnits,
      },
      now: () => at,
      log,
    });
    expect(await holdings.tierFor(['holder'], { mint, tiers, now: new Date(at) })).toBeNull();
    expect(getTokenBaseUnits).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({ code: 'WYNTRAX_TOKEN_PROGRAM_UNSUPPORTED' });
  });

  it('uses the configured fallback mint only when the admin has not saved one', async () => {
    let at = 1_000_000;
    const { rpc } = fakeRpc({ holder: proRaw });
    const holdings = createWyntraxHoldings({ rpc, defaultMint: mint, now: () => at });

    expect(holdings.defaultMint).toBe(mint);
    expect((await holdings.tierFor(['holder'], { tiers, now: new Date(at) }))?.tier).toBe('PRO');
  });

  it('never grants a holding without a linked wallet', async () => {
    let at = 1_000_000;
    const { rpc } = fakeRpc({ holder: proRaw });
    const holdings = createWyntraxHoldings({ rpc, now: () => at });
    expect(await holdings.tierFor([], { mint, tiers, now: new Date(at) })).toBeNull();
  });
});

describe('token amount conversion', () => {
  it('converts whole and fractional amounts exactly', () => {
    expect(baseUnitsFor(500_000, 6)).toBe(500_000_000_000n);
    expect(baseUnitsFor(0.1, 6)).toBe(100_000n);
    expect(baseUnitsFor(1e-7, 6)).toBe(1n);
    expect(baseUnitsFor(1.5, 0)).toBe(2n);
    expect(baseUnitsFor(1e12, 9)).toBe(1_000_000_000_000_000_000_000n);
  });

  it('rejects impossible inputs instead of guessing', () => {
    for (const [amount, decimals] of [[0, 6], [-1, 6], [Number.NaN, 6], [1, -1], [1, 1.5], [1, 37]] as const) {
      expect(() => baseUnitsFor(amount, decimals)).toThrow();
    }
  });
});
