# Smart money (NEAR build)

The smart-money directory now includes a bounded **wallet leaderboard** over recorded wallet
trades, built on the chain-neutral accounting in `docs/WALLET_ACCOUNTING.md`.

## Scope

- `GET /v1/smart-money/rankings`
  - `band`: `ALL`, `SMALL_CAP`, `UNDER_100K`, `100K_500K`, `500K_1M`, `OVER_1M`, `UNKNOWN`
  - `status`: `ALL`, `REVIEW_READY`, `OBSERVING`
  - `limit`: 1–100
  - `minMedianPositionSol`: non-negative native-amount floor
- The endpoint computes 30-day performance for up to 100 active tracked wallets, capped at
  10,000 trades per wallet. It returns `capped: true` when the cohort or result set was cut.
- Ranking order: review readiness, history completeness, Wilson lower bound, realised P&L,
  then address. It is deterministic and descriptive, not a profitability claim.

## What is deliberately absent

- No Helius, Jupiter, Solana RPC, or wallet-history provider is imported by this feature.
- The full investigation/publication workflow (strategies, token discovery, research signals)
  is not included. It requires a NEAR swap-level indexer that records token trades with native
  amounts, not just FT transfers.
- NearBlocks can list FT transfers, but a transfer is not a swap with a reliable native value.
  Using it for cost basis would fabricate evidence, so it is not used for accounting.

## NEAR identity

Wallet detail/explorer links support NEAR account IDs through NearBlocks and keep legacy
Solana links for existing records. The data-ingestion layer must still be replaced with a NEAR
swap source before leaderboard rows represent NEAR wallet activity.
