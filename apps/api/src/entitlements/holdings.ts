/**
 * Direct, read-only $WYNTRAX holding check.
 *
 * The signed Wyntrax webhook is the primary entitlement source. This resolver is the
 * optional fallback for deployments that do not receive that stream: it reads the
 * linked Solana wallet's SPL balance and maps it to the same admin-configured tiers.
 *
 * It never signs, sends, or writes. Every failure is closed: no balance means no tier.
 */
import type { TierRequirementsValue } from '@narra/shared';

export type WyntraxTier = 'MEMBER' | 'PRO';

export interface WyntraxHolding {
  tier: WyntraxTier;
  /** The linked wallet that produced the highest tier. */
  address: string;
  /** Stable source id exposed to the authenticated user. */
  id: string;
}

/** The only two read-only RPC calls this module is allowed to make. */
export interface HoldingRpc {
  getMintInfo(mint: string): Promise<{ decimals: number; program?: string }>;
  getTokenBaseUnits(owner: string, mint: string): Promise<bigint>;
}

export interface WyntraxHoldingsOptions {
  rpc: HoldingRpc;
  /** Fallback mint when the admin has not saved `access.token_mint`. */
  defaultMint?: string | null;
  /** Cache for a wallet balance. Default 5 minutes; clamped to 30s..1h. */
  cacheTtlMs?: number;
  /** Cache for a failed lookup. Default 30 seconds; clamped to 5s..5min. */
  errorTtlMs?: number;
  maxWallets?: number;
  now?: () => number;
  log?: (entry: { code: string }) => void;
}

export interface WyntraxHoldings {
  readonly defaultMint: string | null;
  tierFor(addresses: readonly string[], options: { mint?: string | null; tiers: TierRequirementsValue; now?: Date }): Promise<WyntraxHolding | null>;
}

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Classic SPL Token. Token-2022 needs a program-scoped read, which this fallback does not do. */
const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const DECIMALS_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 5_000;

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Expand JavaScript's shortest decimal form, including exponent notation, without floating point. */
function decimalText(amount: number): string {
  const text = amount.toString();
  if (!/e/i.test(text)) return text;
  const [mantissa = '', exponentText = '0'] = text.split(/e/i);
  const negative = mantissa.startsWith('-');
  const [whole = '0', fraction = ''] = mantissa.replace('-', '').split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponentText);
  const expanded = point <= 0
    ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length
      ? `${digits}${'0'.repeat(point - digits.length)}`
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `${negative ? '-' : ''}${expanded}`;
}

/**
 * Convert a human token amount to base units. Excess fractional digits round up, so a
 * configured minimum is never under-enforced by a lost remainder.
 */
export function baseUnitsFor(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('amount must be positive');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new RangeError('decimals out of range');
  const [whole = '0', fraction = ''] = decimalText(amount).split('.');
  const kept = fraction.padEnd(decimals, '0').slice(0, decimals);
  const remainder = fraction.slice(decimals);
  let raw = BigInt(`${whole || '0'}${kept}`);
  if (/[1-9]/.test(remainder)) raw += 1n;
  return raw;
}

export function createWyntraxHoldings(options: WyntraxHoldingsOptions): WyntraxHoldings {
  const cacheTtlMs = clamp(options.cacheTtlMs ?? 300_000, 30_000, 3_600_000, 300_000);
  const errorTtlMs = clamp(options.errorTtlMs ?? 30_000, 5_000, 300_000, 30_000);
  const maxWallets = clamp(options.maxWallets ?? 8, 1, 20, 8);
  const clock = options.now ?? (() => Date.now());
  const log = options.log ?? (() => undefined);
  const balances = new Map<string, { raw: bigint | null; expiresAt: number }>();
  const mints = new Map<string, { decimals: number | null; expiresAt: number }>();
  const defaultMint = options.defaultMint && MINT.test(options.defaultMint) ? options.defaultMint : null;
  if (options.defaultMint && !defaultMint) log({ code: 'WYNTRAX_MINT_INVALID' });

  const remember = <T>(map: Map<string, T>, key: string, value: T) => {
    map.set(key, value);
    if (map.size > MAX_CACHE_ENTRIES) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) map.delete(oldest);
    }
  };

  const decimalsFor = async (mint: string, at: number): Promise<number | null> => {
    const cached = mints.get(mint);
    if (cached && cached.expiresAt > at) return cached.decimals;
    try {
      const info = await options.rpc.getMintInfo(mint);
      if (info.program && info.program !== SPL_TOKEN_PROGRAM) {
        remember(mints, mint, { decimals: null, expiresAt: at + errorTtlMs });
        log({ code: 'WYNTRAX_TOKEN_PROGRAM_UNSUPPORTED' });
        return null;
      }
      if (!Number.isInteger(info.decimals) || info.decimals < 0 || info.decimals > 36) throw new RangeError('decimals out of range');
      remember(mints, mint, { decimals: info.decimals, expiresAt: at + DECIMALS_TTL_MS });
      return info.decimals;
    } catch {
      remember(mints, mint, { decimals: null, expiresAt: at + errorTtlMs });
      log({ code: 'WYNTRAX_MINT_LOOKUP_FAILED' });
      return null;
    }
  };

  const balanceFor = async (address: string, mint: string, at: number): Promise<bigint | null> => {
    const key = `${mint}:${address}`;
    const cached = balances.get(key);
    if (cached && cached.expiresAt > at) return cached.raw;
    try {
      const raw = await options.rpc.getTokenBaseUnits(address, mint);
      remember(balances, key, { raw, expiresAt: at + cacheTtlMs });
      return raw;
    } catch {
      remember(balances, key, { raw: null, expiresAt: at + errorTtlMs });
      log({ code: 'WYNTRAX_BALANCE_LOOKUP_FAILED' });
      return null;
    }
  };

  return {
    defaultMint,
    async tierFor(addresses, { mint, tiers, now: at }) {
      const target = mint ?? defaultMint;
      if (!target || !MINT.test(target) || addresses.length === 0) return null;
      const time = at ? at.getTime() : clock();
      if (!Number.isFinite(time)) return null;

      let memberRaw: bigint, proRaw: bigint;
      const decimals = await decimalsFor(target, time);
      if (decimals === null) return null;
      try {
        memberRaw = baseUnitsFor(tiers.MEMBER, decimals);
        proRaw = baseUnitsFor(tiers.PRO, decimals);
      } catch {
        log({ code: 'WYNTRAX_TIER_INVALID' });
        return null;
      }
      if (proRaw <= 0n) return null;

      const unique = [...new Set(addresses)].slice(0, maxWallets);
      const results = await Promise.all(unique.map(async address => ({ address, raw: await balanceFor(address, target, time) })));
      let best: WyntraxHolding | null = null;
      for (const { address, raw } of results) {
        if (raw === null) continue;
        const tier: WyntraxTier | null = raw >= proRaw ? 'PRO' : raw >= memberRaw ? 'MEMBER' : null;
        if (!tier) continue;
        if (!best || (tier === 'PRO' && best.tier === 'MEMBER')) best = { tier, address, id: `holding:${target}:${address}` };
      }
      return best;
    },
  };
}

let resolver: WyntraxHoldings | null = null;

/** Configured once at process start. Tests may replace it and reset it to null. */
export function setWyntraxHoldings(value: WyntraxHoldings | null): void {
  resolver = value;
}

export function getWyntraxHoldings(): WyntraxHoldings | null {
  return resolver;
}
