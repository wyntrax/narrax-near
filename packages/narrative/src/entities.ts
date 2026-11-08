import { isNearAccountId, sanitizeUntrusted } from '@narra/shared';

/** One implementation, shared with the API and web app. Re-exported so existing imports keep working. */
export { isNearAccountId };

/**
 * Pulls token references out of a post: NEAR account IDs and $CASHTAGS. Runs in memory during ingestion on
 * untrusted text. Only the extracted references are kept (never the text), and a reference is data, never an
 * instruction. A contract id is a strong reference (it names exactly one token). A cashtag is weak: anyone can
 * launch a token with any symbol, so a cashtag alone can point at a copycat.
 */
export type TokenRefKind = 'CONTRACT' | 'CASHTAG';
export interface TokenRef { kind: TokenRefKind; value: string }

// A token contract is a NEAR named account (`*.near` / `*.testnet`) or a 64-hex implicit account.
// Do not match arbitrary dotted text such as decimal numbers or URL hosts (`t.co`, `31.7`).
const CONTRACT_RE = /(?<![a-z0-9._-])(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+(?:near|testnet)(?![a-z0-9])|[a-f0-9]{64}(?![a-f0-9])/gi;
const CASHTAG_RE = /(?<![\w$])\$([A-Za-z][A-Za-z0-9]{1,14})(?!\w)/g;

/** Majors and quote assets that are never the token someone is shilling. */
export const IGNORED_CASHTAGS: ReadonlySet<string> = new Set([
  'NEAR', 'WNEAR', 'USD', 'USDC', 'USDT', 'BTC', 'ETH', 'WBTC', 'WETH', 'BNB', 'XRP', 'ADA', 'TON', 'AVAX', 'DOT', 'LTC', 'TRX', 'SUI', 'APT', 'EUR',
]);
/** Wrapped NEAR and USDC contracts are quote assets, not candidate tokens. */
const IGNORED_CONTRACTS: ReadonlySet<string> = new Set([
  'wrap.near', 'wrap.testnet',
  '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  'usdc.fakes.testnet',
]);
/** A post naming more than this many tokens is a list or spam, not a call on one token, so none of it counts. */
export const MAX_REFS_PER_POST = 5;

export function extractTokenRefs(raw: string): TokenRef[] {
  const text = sanitizeUntrusted(raw, 20_000);
  const refs = new Map<string, TokenRef>();
  for (const m of text.matchAll(CONTRACT_RE)) {
    const value = m[0].toLowerCase();
    if (!IGNORED_CONTRACTS.has(value) && isNearAccountId(value)) refs.set(`CONTRACT:${value}`, { kind: 'CONTRACT', value });
  }
  for (const m of text.matchAll(CASHTAG_RE)) {
    const tag = m[1]!.toUpperCase();
    if (!IGNORED_CASHTAGS.has(tag)) refs.set(`CASHTAG:${tag}`, { kind: 'CASHTAG', value: tag });
  }
  return refs.size > MAX_REFS_PER_POST ? [] : [...refs.values()];
}
