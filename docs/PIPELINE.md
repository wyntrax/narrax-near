# Research pipeline

The pipeline is research-only. It has no trading, custody, portfolio or executor path.

## Jobs

| Queue | Work |
|---|---|
| `narrative-ingestion` | Treg social ingestion, narrative metrics and mentions |
| `token-resolution` | Narrative-token matching, social token discovery, opportunity scoring |
| `market-data` | NEP-141 metadata, DEX prices/liquidity, holders, deterministic risk rows |
| `ai-analysis` | Fast screen, bull/bear/risk roles, decision, deterministic guardrails |
| `outcome-tracking` | 1h/24h decision outcomes and Early Radar horizons |
| `notification-dispatch` | Global and user alerts to notifications |
| `realtime-publish` | New rows to the Redis event stream |
| `telegram-delivery` | Optional global Early Radar alerts to Telegram |

## Token identity

A token is identified by its exact NEAR account id (named `.near`/`.testnet` account or 64-hex
implicit id). NEP-141 metadata is read with `ft_metadata`; no token-controlled metadata URL is
fetched. Ticker matches are candidates, never identity proof.

## Market evidence

DEX Screener supplies price, liquidity, volume and pair age. GeckoTerminal supplies holder count
and concentration when available. Missing values are not replaced with zero. A price older than
15 minutes or a holder row older than 60 minutes is stale.

## Early Radar

Tokens under $100K market cap can be scored as `trencher` or `holder`. The hard gates cover
liquidity, holders, top-10 concentration, age and liquidity-to-cap ratio. Missing holder or
concentration evidence fails closed. Alerts are written only; they do not create opportunities,
orders or positions.

## Social input

Treg topics come from `TOPIC_PACKS` (`near`, `trencher`, `chatter`, `holder`). Posts are scanned
in memory for NEAR account ids and `$CASHTAGS`; only extracted references and hashes are stored.
Raw post text is never stored. Social text is untrusted and is sanitized before storage or display.
