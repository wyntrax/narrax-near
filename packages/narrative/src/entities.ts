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

const CONTRACT_RE = /(?<![a-z0-9._-])(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+[a-z0-9]+(?:[-_][a-z0-9]+)*|[a-f0-9]{64}(?![a-z0-9])/gi;
const CASHTAG_RE = /(?<![\w$])\$([A-Za-z][A-Za-z0-9]{1,14})(?!\w)/g;

/** Majors and quote assets that are never the token someone is shilling. */
export const IGNORED_CASHTAGS: ReadonlySet<string> = new Set([
  'NEAR', 'WNEAR', 'USD', 'USDC', 'USDT', 'BTC', 'ETH', 'WBTC', 'WETH', 'BNB', 'XRP', 'ADA', 'TON', 'AVAX', 'DOT', 'LTC', 'TRX', 'SUI', 'APT', 'EUR',
]);
/** A post naming more than this many tokens is a list or spam, not a call on one token, so none of it counts. */
export const MAX_REFS_PER_POST = 5;

export function extractTokenRefs(raw: string): TokenRef[] {
  const text = sanitizeUntrusted(raw, 20_000);
  const refs = new Map<string, TokenRef>();
  for (const m of text.matchAll(CONTRACT_RE)) {
    const value = m[0].toLowerCase();
    if (isNearAccountId(value)) refs.set(`CONTRACT:${value}`, { kind: 'CONTRACT', value });
  }
  for (const m of text.matchAll(CASHTAG_RE)) {
    const tag = m[1]!.toUpperCase();
    if (!IGNORED_CASHTAGS.has(tag)) refs.set(`CASHTAG:${tag}`, { kind: 'CASHTAG', value: tag });
  }
  return refs.size > MAX_REFS_PER_POST ? [] : [...refs.values()];
}
