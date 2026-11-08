# Research pipeline

The pipeline is research-only. It has no trading, custody, portfolio or executor path.

## Jobs

| Queue | Work |
|---|---|
| `narrative-ingestion` | Treg social ingestion, narrative metrics and mentions |
| `token-resolution` | Narrative-token matching, social token discovery, opportunity scoring |
| `market-data` | NEP-141 metadata, DEX prices/liquidity, holders, deterministic risk rows |
| `smart-money` | Public NEAR pool trades, observed wallet trades and average-cost profiles |
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

## Smart Money

The `smart-money` queue reads recent public NEAR pool trades from GeckoTerminal and stores only
trades for tokens already in the research universe. It deduplicates by provider trade id and
recomputes average-cost wallet profiles for affected wallets. Realized PnL uses only sells with an
observed buy basis; open positions, unmatched sells and oversized sells are not treated as clean
evidence. Wallets are not clustered by funding source. See `docs/SMART_MONEY.md` for exact rules,
API routes and limits.

## Early Radar

Tokens under $100K market cap can be scored as `trencher` or `holder`. The hard gates cover
liquidity, holders, top-10 concentration, age and liquidity-to-cap ratio. Missing holder or
concentration evidence fails closed. Alerts are written only; they do not create opportunities,
orders or positions.

## Social input

Treg topics come from `TOPIC_PACKS` (`near`, `trencher`, `chatter`, `holder`). Posts are scanned
in memory for NEAR account ids and `$CASHTAGS`; only extracted references and hashes are stored.
Raw post text is never stored. Social text is untrusted and is sanitized before storage or display.

### Enabling narrative ingestion

The radar is empty until a social source is configured and at least one collection run finishes.
For a local machine with an authenticated `treg` CLI:

```bash
treg login
npm run narratives:treg -- --cli --query "NEAR" --platforms x,reddit --write
```

For a worker or server, use a Treg token instead of the CLI session:

```bash
TREG_NARRATIVE_ENABLED=true
TREG_TOKEN=...
TREG_NARRATIVE_PACKS=near,trencher
TREG_NARRATIVE_PLATFORMS=x,reddit
npm run dev:workers
```

A missing or expired Treg credential does not break the rest of the app; it only leaves the
narrative tables empty until ingestion is configured.
