# Smart Money (observed NEAR wallets)

Smart Money is a **research** surface built from public NEAR DEX trades. It does not connect a
wallet, sign, trade, custody funds or predict returns. The first version observes recent public
trades from GeckoTerminal, stores them, and calculates an average-cost profile for each wallet.

## Data source and coverage

- Source: GeckoTerminal public NEAR pool trade feed.
- Pools: active tokens in the research universe with fresh market evidence, ordered by current
  liquidity and capped by `SMART_MONEY_MAX_POOLS`.
- The provider returns a recent bounded trade window (currently the latest 300 trades per pool,
  up to 24 hours). This is **not** a complete archive.
- The worker polls every `SMART_MONEY_INTERVAL_MS` and deduplicates by the provider trade id.
  History starts on the first successful observation run. There is no backfill and no invented
  history.
- Provider-anomalous trades are excluded. Trades without a valid NEAR account, timestamp, token
  amount or USD value are excluded.
- Only exact NEAR contract ids already in the research universe are stored. Reference assets
  (wrapped NEAR and stablecoin contracts used by the market pipeline) are not candidate tokens.
- Each observed trader is checked with `SMART_MONEY_ACCOUNT_RPC_URL` (default
  `https://free.rpc.fastnear.com`, falling back to `https://rpc.mainnet.near.org`).
  Contract/relayer accounts are excluded from wallet profiles. Already-stored wallets are trusted
  as externally owned and are not rechecked; an account-kind check that fails for a new address is
  counted and that trader is skipped. GeckoTerminal's `near` market is mainnet, so this RPC is
  deliberately separate from a testnet `NEAR_RPC_URL`.
- Missing values stay missing. A current price is never substituted for a historical trade value.

## What is calculated

For each wallet, trades are ordered by time and accounted per token with average cost.

BUY:

```
observed units += token amount
observed cost  += USD value
```

SELL:

```
sold units      = min(sell amount, observed units)
cost of sold    = observed cost * sold units / observed units
proceeds        = sell USD value * sold units / sell amount
realized PnL    = proceeds - cost of sold
```

Only realized PnL is reported. Open positions are not marked to market.

A sell with no earlier observed buy has no usable basis and is excluded from PnL
(`unmatchedSells`). A sell larger than the observed position realizes only the observed part and
is flagged (`excessSellUnits`). A wallet with either flag cannot be qualified.

### Wallet score

The score is `0..100`, or null below five closed legs. It uses:

- 35% Wilson lower-bound win rate,
- 30% median ROI (capped at 200%),
- 20% profit factor (capped at 4),
- 15% drawdown quality.

A track-record multiplier grows from 0.6 to 1.0 as closed legs go from 0 to 20. Sample size only
discounts a record; it never adds points. A high score is not a forecast.

### Qualification

Starting values, all visible in code and configurable:

| Rule | Default |
| --- | --- |
| Closed trades | 5 |
| Closed tokens | 2 |
| Observed period | 24 hours |
| Observed buy + sell volume | $100 |
| Minimum score | 60 |
| Unmatched sells | 0 |
| Oversized sells | 0 |
| Realized PnL | positive |
| Median ROI | positive |

Status:

- `QUALIFIED`: every rule passes.
- `PROVISIONAL`: enough data to profile, but a performance threshold fails.
- `INSUFFICIENT`: the sample, basis, observed period or score is not complete enough.

These are starting research thresholds, not validated performance guarantees.

## What is deliberately not claimed

- **No entity clustering.** Wallets are ranked individually. This build does not retrieve funding
  sources or infer common ownership, so one entity can appear as multiple wallets.
- **No complete history.** Early sells may be unmatched because the buy happened before
  collection started. They are excluded, not guessed.
- **No mark-to-market PnL.** Open observed positions are not valued in the profile.
- **No wash-trade proof.** The provider anomaly flag is respected, but an unflagged wash trade or
  self-transfer may look like a normal swap.
- **No execution path.** There is no order, swap, signing or custody code.

## API

All routes require authentication and `research.smart_money` access.

| Route | Purpose |
| --- | --- |
| `GET /v1/smart-money/wallets` | Observed wallet profiles and coverage summary; returns the saved anonymized aggregate when raw tables are empty |
| `GET /v1/smart-money/flows?window=24h` | Token buy/sell flows in a 1h, 6h or 24h window |
| `GET /v1/smart-money/wallets/:address` | Profile, token activity and latest observed trades |
| `GET /v1/smart-money/meta` | Source and calculation notes |

The list route supports `limit`, `q` (address prefix), `status` and `sort` (`pnl`, `score`,
`recent`). It is capped by the current access tier's page limit. When the raw wallet tables are empty,
it returns `source: "AGGREGATE"` and the saved anonymized summary in `aggregate`; it never fabricates
wallet rows or transaction hashes.

## UI

- `/app/smart-money`: coverage metrics, observed wallet table and token flows. With the demo seed it
  shows the saved aggregate and an explicit notice that individual wallet rows are omitted.
- `/app/smart-money/[address]`: profile, reasons, token activity and latest trades.
- Wallet and transaction links use the configured NearBlocks explorer.

## Configuration

See `.env.example`:

```dotenv
SMART_MONEY_ENABLED=true
SMART_MONEY_ACCOUNT_RPC_URL=https://free.rpc.fastnear.com
SMART_MONEY_MAX_POOLS=20
SMART_MONEY_INTERVAL_MS=600000
SMART_MONEY_MIN_CLOSED_TRADES=5
SMART_MONEY_MIN_CLOSED_TOKENS=2
SMART_MONEY_MIN_OBSERVED_HOURS=24
SMART_MONEY_MIN_VOLUME_USD=100
SMART_MONEY_MIN_SCORE=60
```

Malformed numeric values fall back to the safe defaults. The worker records its last run in
`SystemSetting` key `research.smartMoney.health` (counts and error codes only; no provider bodies).

## Operational notes

- The public GeckoTerminal API is rate-limited. The existing market-data client spaces requests;
  keep `SMART_MONEY_MAX_POOLS` modest on a shared IP.
- A provider failure is counted and does not erase existing trades or profiles.
- The first profile list is empty until market evidence exists and the worker observes trades.
- Changing qualification thresholds does not rewrite history. Restart the worker and run another
  observation cycle; affected profiles are recomputed when new trades arrive.
