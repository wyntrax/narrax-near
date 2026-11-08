export type MarketDataErrorKind = 'rate_limited' | 'http' | 'network' | 'shape';

/** Every provider failure is one of these, so callers can tell "slow down" from "bad data" and always fail closed. */
export class MarketDataError extends Error {
  constructor(public readonly kind: MarketDataErrorKind, message: string) { super(message); }
}

/** NEAR chain id used by the public market-data APIs. */
export const NEAR_CHAIN_ID = 'near';
/** Wrapped NEAR on mainnet. Testnet deployments use wrap.testnet; both are reference assets, never candidates. */
export const WNEAR_CONTRACT = 'wrap.near';
export const NEAR_REFERENCE_CONTRACTS: ReadonlySet<string> = new Set([
  WNEAR_CONTRACT, 'wrap.testnet',
  // Mainnet and testnet USDC contracts used as quote assets.
  '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  'usdc.fakes.testnet',
]);

/** Price and liquidity facts for one token, taken from its deepest pool. Every number here was present in the source. */
export interface MarketSnapshot {
  mint: string;
  /** Untrusted. Sanitize before storing. */
  symbol: string;
  /** Untrusted. Sanitize before storing. */
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  /** True when the source gave no market cap and the fully diluted value was used instead. */
  marketCapIsFdv: boolean;
  liquidityUsd: number;
  volume24hUsd: number;
  priceChange1hPct: number | null;
  pairAddress: string;
  dexId: string | null;
  /** When the deepest pool was created. A proxy for token age, not the contract creation time. */
  pairCreatedAt: Date | null;
}

/** Token facts that need a deeper lookup. A null means the source did not say, never "zero" or "safe". */
export interface TokenInfo {
  mint: string;
  name: string | null;
  symbol: string | null;
  holders: number | null;
  /** Percent of supply (0 to 100) held by the ten largest accounts. May include pool and exchange accounts. */
  top10Pct: number | null;
  websites: string[];
  twitterHandle: string | null;
}

export interface NewPool {
  mint: string;
  /** Untrusted. */
  symbol: string;
  /** Untrusted. */
  name: string;
  poolAddress: string;
  createdAt: Date;
  liquidityUsd: number | null;
}

/** Current price, liquidity and volume. Contracts missing from the result had no usable data. */
export const SNAPSHOT_OMISSION_REASONS = ['NO_MATCHING_PAIR', 'INVALID_PAIR', 'PRICE_UNAVAILABLE', 'LIQUIDITY_UNAVAILABLE', 'VOLUME_UNAVAILABLE', 'MARKET_VALUE_UNAVAILABLE', 'UNSPECIFIED'] as const;
export type SnapshotOmissionReason = typeof SNAPSHOT_OMISSION_REASONS[number];
export interface SnapshotRead {
  snapshots: Map<string, MarketSnapshot>;
  /** One first blocking reason per omitted mint; diagnostic only, never qualification evidence. */
  omissions: Map<string, SnapshotOmissionReason>;
}

export interface MarketQuoteSource {
  readonly name: string;
  getSnapshots(mints: string[]): Promise<Map<string, MarketSnapshot>>;
  /** Same bounded provider requests, with omission reasons from that exact response. */
  getSnapshotsWithDiagnostics?(mints: string[]): Promise<SnapshotRead>;
}

export interface TokenInfoSource {
  readonly name: string;
  /** null when the source does not know the token. Throws on any failure. */
  getTokenInfo(mint: string): Promise<TokenInfo | null>;
}

export interface LaunchSource {
  readonly name: string;
  getNewPools(): Promise<NewPool[]>;
}
