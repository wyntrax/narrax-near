# NARRAX — a NEAR ecosystem thesis

> Research only. This is not a price prediction, a recommendation, or financial advice.
> No performance number is hardcoded in this document. Every figure must come from the running
> pipeline, and a metric that cannot be computed stays unknown.

## The claim

NEAR's durable value comes from attention that converts into measurable on-chain activity, not from
attention volume by itself. A narrative that produces posts but no liquidity, no distributed
ownership, and no repeat wallet participation is attention without adoption. A narrative that does
produce those things is a candidate for durable ecosystem value.

NARRAX tests that claim at the narrative and token level. It joins public conversation to an exact
NEP-141 contract, then asks whether the market and ownership evidence confirm the story: Is there
liquidity deep enough to trade? Is ownership spread beyond one wallet? Are multiple wallets actually
trading it? Or is the attention unsupported?

The thesis is about the quality of NEAR's token economy, not the price of any single token. Price is
only one observation in the evidence set.

For NEAR, the distinction matters. A chain can manufacture attention cheaply; it cannot manufacture
liquidity, distributed ownership, or repeat users as easily. If attention rarely converts, growth is
mercenary and the long-term case should rest on other fundamentals. If conversion is common and
persists, narrative-driven activity is a real adoption channel rather than a marketing cycle.

## Why this is testable on NEAR

- Token identity is an account id, so a social reference can be resolved to one exact contract rather
  than a ticker guess.
- NEP-141 `ft_metadata` is a public view call, so identity is reproducible by anyone.
- NEAR's DEX activity is indexed by public providers, so liquidity and trade flow can be observed
  without a custodial integration.
- All collection is read-only. The pipeline stores observations; it cannot sign, trade, or move funds.

## Hypotheses

| # | Hypothesis | What would support it | What would falsify it |
| --- | --- | --- | --- |
| H1 | Narrative attention is a lead only when the token later shows real liquidity and holder growth. | Tokens that pass confirmation floors have different 1h/24h outcomes from attention-only candidates. | Attention has no measurable relationship with later liquidity, holders, or outcomes after controls. |
| H2 | Confirmation layers are more informative together than any one alone. | Liquidity + distributed holders + observed multi-wallet flow separate outcomes better than any single layer. | The layers add no separation, or one layer explains everything. |
| H3 | Smart-money profiles from observed public trades persist out of sample. | Wallets with sustained observed profiles keep separating from one-off wallets in later windows. | Profiles fail out of sample or are explained by a single lucky trade. |

## Evidence the workspace produces

| Layer | Measurement | Source |
| --- | --- | --- |
| Narrative | Stage, velocity, mention quality, manipulation risk | Configured Treg social ingestion |
| Identity | Exact NEAR account id, NEP-141 name and symbol | NEAR RPC `ft_metadata` |
| Market | Price, liquidity, 24h volume, pair age | DEX Screener `near` (mainnet) |
| Ownership | Holder count, top-10 share of supply | GeckoTerminal, then NearBlocks fallback (mainnet) |
| Risk | Deterministic liquidity, holder, age and concentration flags | Local rules in `packages/market-data` |
| Flow | Observed public pool trades, wallet cost basis, average-cost profiles | GeckoTerminal trades + mainnet RPC account checks |
| Outcome | 1h/24h observations and Early Radar horizons | Stored market rows in Postgres |

Bridged assets (`*.omft.near`, `*.omdep.near`, `*.bridge.near`) are reference/quote assets and are
excluded from narrative links, launch candidates and the thesis conversion cohort.

### Generated evidence

[`THESIS_EVIDENCE.md`](./THESIS_EVIDENCE.md) is rebuilt from Postgres with:

```bash
npm run thesis:report -- --write
```

It contains the current research universe, narrative-to-token conversion, Early Radar outcomes,
smart-money observations and collection quality. It is a dated snapshot, not a backtest, and the
script is the only thing that should produce those numbers.

[`THESIS_CONTEXT.md`](./THESIS_CONTEXT.md) is the separate NEAR macro backdrop, rebuilt from public
data with no database or keys:

```bash
npm run thesis:context -- --write
```

It covers TVL, stablecoin supply, price, market cap, node count and the latest final block from
DefiLlama, CoinGecko, NearBlocks and NEAR mainnet RPC. It is deliberately not a claim that narrative
attention predicts NEAR price.

## The two clocks

NEAR macro fundamentals and narrative attention move on different clocks. TVL, stablecoin supply,
price and market cap are slow network-level series. Narrative attention and token-level
liquidity/holders move much faster, and most of that movement never becomes durable adoption.

NARRAX tests the conversion, not the prediction: does attention become liquidity, distributed
ownership and observed trade flow? The macro series is the backdrop, not the answer. This keeps the
thesis honest: a rising macro series does not validate an individual token, and a loud narrative does
not validate itself.

## Evidence for the thesis (design choices)

The product encodes the claim in what it refuses to do:

- A narrative name or ticker match alone never creates a ranked opportunity. Liquidity and holder
  floors must be met first.
- A social reference creates a token row only after a market source confirms that the contract trades.
- Early Radar fails closed when holder or concentration evidence is missing; it never substitutes a
  zero or a guess.
- Smart Money stores only observed public trades, excludes contract accounts, does not backfill, and
  does not invent a cost basis for unmatched sells.
- Missing values remain unknown across every surface.

These are falsifiable choices: if attention alone were enough, the extra confirmation layers would
add nothing, and the pipeline would be over-constrained.

## Evidence against the thesis (limits)

- **Mainnet-only market coverage.** DEX Screener and GeckoTerminal index mainnet NEAR; there is no
  testnet market feed. A testnet-configured build can only exercise chain status and metadata.
- **Recent trade window, not history.** The public trade feed returns a bounded recent window
  (about the latest 300 trades per pool, up to 24 hours). Smart Money history starts when collection
  starts.
- **Holder concentration is approximate.** The top-10 share is of total supply and may include pool
  and exchange accounts, so it can overstate concentration. NearBlocks only covers tokens it has
  indexed; everything else stays unknown.
- **Bridged assets are excluded.** Tokens under `*.omft.near`, `*.omdep.near` or `*.bridge.near` are
  reference/quote assets, not narrative research candidates, and are removed from narrative links and
  the conversion cohort.
- **Social data is adversarial.** Organic-quality checks are heuristics, not proof. A coordinated
  campaign can still look organic.
- **Wallet profiles are incomplete.** Wallets are not clustered by funding source, unmatched sells
  are excluded from realized PnL, and open positions are not treated as clean evidence.
- **Outcome horizons are short.** 1h/24h observations cannot prove a long-term ecosystem thesis.
- **Coverage is bounded.** Only tokens in the research universe are measured; everything else is
  unknown, not zero.
- **One channel, not the whole chain.** The thesis measures token-level attention conversion, not
  NEAR's full fundamentals such as developer activity, NEAR Intents volume, or enterprise adoption.
- **Narrative ingestion needs a provider.** Without Treg configured, the radar is empty rather than
  filled with synthetic data.

## What would change my mind

- Narrative velocity and stage show no relationship with later liquidity, holder growth, or outcomes
  once liquidity and holder concentration are controlled for.
- Tokens that pass the confirmation floors have the same outcomes as attention-only candidates.
- Smart-money profiles do not persist out of sample, or one lucky trade explains the result.
- Most confirmed "adoption" is a single wallet, a wash trade, or a pool account rather than broad
  participation.
- The conversion effect disappears outside the short observation window.

If those hold, the thesis should be revised: attention conversion would be a description of the
past, not a useful signal about durable ecosystem value.

## Reproduce it

### Requirements

- Node 22+
- Postgres 16+
- Redis 7+ with Redis Streams
- A Treg credential for narrative ingestion (optional; everything else runs without it)

### Run the research build

```bash
cp .env.example .env
# For market evidence, point the chain config at mainnet:
#   NEAR_NETWORK=mainnet
#   NEAR_RPC_URL=https://rpc.mainnet.near.org
#   NEAR_EXPLORER_URL=https://nearblocks.io
# The safe default is testnet, but testnet has no DEX Screener/GeckoTerminal market feed.
npm install
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm run dev:api        # API on :4000
npm run dev:web        # web on :4010
npm run dev:workers    # research pipeline
```

Set `NEXT_PUBLIC_NEAR_NETWORK=mainnet` in the web environment when the research universe is mainnet,
so explorer links resolve to the same network as the evidence.

### Do X → see Y

1. Open `/radar` → see narrative stages, velocity, and the evidence behind each narrative.
2. Open `/tokens` → see observed liquidity, volume, holder count, and deterministic risk flags.
   Unknown values stay unknown.
3. Open `/tokens/<account-id>` → see the exact NEP-141 identity, narrative attribution, holder
   concentration, risk flags, and observed wallet flow for one token.
4. Open `/opportunities` → see which tokens cleared the liquidity and holder floors. A name match
   alone is only a candidate.
5. Open `/smart-money` → see wallets observed in public mainnet pool trades, their average-cost
   profiles, and mainnet explorer links.
6. Open `/alerts` → see Early Radar alerts and the gates they had to pass. No alert creates an order.
7. Open `/analytics` → see decision outcomes tracked at 1h and 24h.

### Where the numbers live

The evidence is written to Postgres by the pipeline. This repository ships the method, not a frozen
dataset: run the same commands against the same public providers to rebuild the observations. No
figure in a submission should be copied from this document, because this document intentionally
contains none.
