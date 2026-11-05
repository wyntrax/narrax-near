# Wallet accounting

The wallet detail API and page include a snapshot of **remaining observed inventory** from
tracked-wallet swaps.

## What it computes

- Average-cost accounting over the last **30 days** of observed `WalletTrade` rows.
- One flat-to-flat position is one accounting unit; partial exits do not create a new entry.
- Exact decimal arithmetic for quantity and remaining cost.
- `UNKNOWN` when the cost basis is incomplete: missing token quantity, an oversized sell,
  or a malformed trade excludes the affected token rather than inventing free tokens.
- A bounded sample: at most 10,000 trades. `capped` is returned when the limit was reached.

## What it does not claim

This is **not** an on-chain wallet balance:

- transfers, airdrops, unsupported swaps and current chain balances are not reconciled;
- mark-to-market prices are shown separately and are marked stale after 15 minutes;
- it is not wallet P&L, a trading recommendation or a copy-trade signal.

## Entry-cap bands

Entry bands (`UNDER_100K`, `100K_500K`, `500K_1M`, `OVER_1M`, `SMALL_CAP`) are assigned only from
frozen pre-trade market evidence stored on the trade row. Missing, future, FDV-only or stale
evidence leaves the band `UNKNOWN`; a later market cap is never substituted.

## NEAR adaptation

The accounting layer is chain-neutral and uses the recorded native amount. The current wallet
ingestion path is still the copied Solana pipeline, so a NEAR indexer/RPC source must populate
`WalletTrade` rows before this snapshot represents NEAR wallet activity.
