# Radar topics and the early lane (2026-10-16)

## Why the radar only showed Solana

The radar is a **watchlist**, not trend discovery. It searches exactly the topics you configure, and the local config
had one: `[{"name":"Solana ecosystem","query":"solana"}]`. One topic can only produce one narrative.

## Topic packs

Set `TREG_NARRATIVE_PACKS` (comma separated). Packs and `TREG_NARRATIVE_TOPICS` combine; custom topics win a name clash.

| Pack | Topics | For |
|---|---|---|
| `solana` | Solana ecosystem | the previous default |
| `trencher` | Pumpfun meta, Community takeover, Lowcap gems, Viral memes, Agent coins | memecoin trenches |
| `holder` | Solana DePIN, RWA, DeFi, gaming, Builders shipping | longer-term, product-backed |
| `chatter` | Contract drops, Ape calls | posts likely to carry a mint or $TICKER (feeds social discovery below) |

```powershell
$env:TREG_NARRATIVE_PACKS='trencher,holder'
$env:TREG_NARRATIVE_PLATFORMS='x'            # cheapest; add reddit,tiktok later
$env:TREG_NARRATIVE_INTERVAL_MS='3600000'    # 1 hour
# optional: add your own theme on top
$env:TREG_NARRATIVE_TOPICS='[{"name":"Zorblax","query":"zorblax OR $ZORB"}]'
```

Limit: 10 topics per run (`trencher,holder` is exactly 10; `trencher,chatter` is 7; all three is 12 and is refused). Going over is an error, never a silent cut. The worker logs `estimatedCycleCostUsd`.
Catalog estimate: 10 topics on X only is about $0.0075 a cycle (about $0.18/day hourly, $0.36/day every 30 min);
10 topics on all three platforms is about $0.03 a cycle. Estimates, not billing.

**Matching caveat.** A narrative is matched to tokens by comparing its name words (4+ letters) with token names and
symbols. Names such as "Agent coins" or "Community takeover" find tokens that use those words. For a theme you see on
your timeline, add it as a custom topic named after the word tokens will actually use.

## Early lane (market cap under $100K)

`packages/token-intel/src/earlyRadar.ts`, called from `resolveTokens`. For every token matched to a live narrative whose
market cap is under `EARLY_RULES.maxMarketCapUsd` ($100K) it scores two profiles and writes an alert
(`EARLY_RADAR_TRENCHER` or `EARLY_RADAR_HOLDER`, WATCH from 55, IMPORTANT from 70, at most one per token per profile
per 6 hours).

| Rule | trencher | holder |
|---|---|---|
| min liquidity | $3K | $8K |
| min holders | 30 | 150 |
| max top 10 share | 70% | 45% |
| max dev share | 15% (unknown flagged) | 5% (unknown flagged, score capped at 60 = never STRONG) |
| age | 10 min to 72 h | 12 h to 30 days |
| min liquidity / cap | 5% | 8% |

Both exclude: cap at or above $100K or under $2K, honeypot, active mint or freeze authority, suspicious copy, dead narrative,
unknown holders, concentration or age. Flags that cap the score: possible wash volume, manipulated-looking narrative,
price that ran ahead of attention, not the OG or origin unverified (holder), ticker-only match, unknown dev share (holder).

"Community" is a proxy: holder count, holder growth over about 3 h, smart-wallet holders, narrative organic score.

**What it does not do.** It writes alerts only. It writes no opportunity, decision, order or position, and the AI step
still demotes anything under the main floors ($20K liquidity, 50 holders), so no trade can come from this lane.
All weights and thresholds are unvalidated starting values. A high score is not a prediction.

**Known data gap.** The free market sources never report developer holding, so `devHoldingPct` is stored as null for every
token. That is why an unknown dev share cannot exclude a holder candidate (it would never fire) and instead caps it at WATCH.
Real dev-holding data (deployer wallet balance) is the next thing that would raise holder-profile quality.

**Data dependency.** The market-data job only creates launch tokens with at least $5K liquidity
(`launchMinLiquidityUsd`), so a token between $3K and $5K liquidity appears only if wallet activity found it first.

## Social token discovery (finds tokens from chatter, not from narrative names)

The narrative route only finds a token whose name shares words with a narrative. Memecoins mostly spread by `$TICKER` or
contract address, so a second route reads those directly.

1. **Extraction** (`packages/narrative/src/entities.ts`, called inside `ingestNarratives`). While a post is in memory it is
   scanned for Solana mint addresses (base58 that decodes to exactly 32 bytes) and `$CASHTAGS`. Majors (SOL, USDC, BTC...)
   are ignored. A post naming more than 5 tokens is a list or spam and contributes nothing. Only the extracted reference plus
   the usual hashes are stored in `TokenMention` (migration `0014_token_social_mentions`). **Raw text is still never stored.**
2. **Scan** (`workers/pipeline/src/socialTokens.ts`, `scanSocialTokens`). Runs at the end of the token-resolution job in
   `dev:workers` (no new queue). It keeps references named by at least 3 distinct accounts and 4 posts in 48 h
   (`SOCIAL_RULES`), then resolves them:
   - a **mint** matching a known token resolves directly. An unknown mint becomes a `Token` row only if DexScreener confirms it
     trades and its market cap is under $100K, at most 10 per run (a pool address or fresh spam mint is left alone). The row has
     no price yet; the market-data job fills it, and the next scan evaluates it.
   - a **$TICKER** resolves only when exactly one known token with a recent price carries that symbol. Zero or several matches are
     skipped and counted as `cashtagsAmbiguous`. A ticker-only match is flagged `TICKER_MATCH_ONLY` and capped at 60 because
     anyone can launch a copycat with the same symbol.
3. **Scoring.** The chatter about one token is scored with the same `computeNarrativeMetrics` used for narratives, so it gets
   velocity, a stage, and the copy-paste / burst / new-account manipulation check. Then `evaluateEarlyBoth` runs with
   `relation: 'UNKNOWN'` (flag `ORIGIN_UNVERIFIED`, holder capped at 65) and writes the same `EARLY_RADAR_*` alerts, deduplicated
   per token per profile per 6 hours across both routes. Titles say "from social buzz".
4. `TokenMention` rows older than 7 days are pruned by the scan.

Run `dev:narratives` (or the pipeline's narrative job) to collect, `dev:market` for prices/holders/risk, and `dev:workers` for the
scan. The scan needs the market data to exist; without it nothing is evaluated (fail closed).

To collect more mints and tickers use `TREG_NARRATIVE_PACKS='trencher,chatter'`. The chatter topics also appear as narratives in the Radar.

Limits: search is sampled, and a coordinated shill still looks like several accounts (the organic check catches copy-paste and
bursts, not paid accounts with varied text). Creator account age is unknown from Treg, so the new-account check is inactive.
Thresholds in `SOCIAL_RULES` are unvalidated starting values.

## Outcome tracking (implemented October 16)

`EarlyRadarOutcome` freezes profile, score tier (`WATCH`/`STRONG`), discovery route (`NARRATIVE`/`SOCIAL`), match kind (`NAME`/`MINT`/`TICKER_ONLY`), score, entry metric ID, time, price and valuation with every new early alert. Valuation basis/source remain null unless exact metric-ID provenance exists. `createEarlyRadarAlert` creates the alert/snapshot/three measurement rows atomically and serializes token/profile creation across both discovery routes for the six-hour dedupe window.

`EarlyRadarMeasurement` records target/observed time, metric ID, price, market cap/FDV basis and gross return at **1h, 24h and 7d**. Entry must be at/before alert time and within 15 minutes. Horizons use the first positive stored price at/after target, no more than 30 minutes late and never beyond the evaluation clock. Missing/invalid prices remain null; missing market cap is independent of price. No fill/PnL is inferred.

`trackEarlyRadarOutcomes` runs in the existing outcome-tracking job, up to 200 due measurements per run, pending rechecks every five minutes. Missing observations remain PENDING while the window is open, then UNKNOWN. Known horizon readings with missing entry retain price/cap but no return. Terminal results, including UNKNOWN, are immutable: later backfills cannot silently select winners. Up to 50 legacy alerts are registered per run with UNKNOWN attribution/tier and `LEGACY_NO_SNAPSHOT`, without parsing prose or borrowing today's price.

Run **`npm run early-radar:report -- --from <ISO> --to <ISO>`** for a read-only cohort report (default last 30 days). Each profile/tier/route/match-kind group includes all three horizons, raw/independent/overlap-excluded counts, known/pending/unknown counts, unknown rate, return statistics and existing evidence gates. Same-token overlaps are removed before missing outcomes are filtered, using the respective horizon. Gates require 30 independent known events across 15 tokens; below that reports explicitly say INSUFFICIENT DATA. Passing a gate does not establish predictive power. Reads are capped at 5,000 rows; truncation is disclosed and suppresses sufficiency. Cohorts can share tokens and are not independent experiments.

Migration `0015_early_radar_outcomes` was generated with Prisma migrate dev and verified on isolated services. As of 2026-10-17 it **is applied to the application database** `narra_ent` (confirmed in `_prisma_migrations`; both `EarlyRadarOutcome` and `EarlyRadarMeasurement` exist). Keep market ingestion active throughout the seven-day window; the outcome job reads stored observations, with no candle backfill or live fetch. Genuine long-window performance remains unverified.

### Refresh priority for open measurements (2026-10-17)

The market-data job refreshes at most 150 tokens a run, taking ids in order, and its own comment warned the tail can starve.
New tokens have the highest ids, so once more than 150 tokens were active the newest early-radar tokens could miss their
refresh, drop out of the 24 h "recently priced" window, and end with UNKNOWN 24h and 7d outcomes. `refreshMarketData` now
refreshes tokens that still have a `PENDING` `EarlyRadarMeasurement` first (nearest-due first, at most
`maxEarlyRadarTokensPerRun` = 100 of the 150, so they cannot crowd out everything else). Check coverage with
`early-radar:report`: a high unknown rate on 24h/7d means this or the market job itself is still missing readings.

## Current verification

Full actual results, original failures/fixes, isolated-service details, live call receipts and per-token account counts: [EARLY_RADAR_VERIFICATION_2026-10-16.md](EARLY_RADAR_VERIFICATION_2026-10-16.md).

- Installed versions per owner: PostgreSQL 17.2 and Memurai Redis API 8.2.10, separate test/shadow databases and Redis process.
- All migrations applied to the test DB; generated Prisma client and schema diff passed (`-- This is an empty migration.`).
- Final full suite: **1,189 tests passed, zero failed/skipped/todo, all 93 files passed**. Full repository/web typecheck passed. All four social-token integration tests ran; their scoring fixture needed no change.
- One approved live preview: 22 accepted posts, nine mints/nine cashtags, seven usable market quotes, three reported caps below $100K. Cost **$0.00155**, no import, no raw text persisted, no threshold/cost/topic increase.
- Outcome tests used synthetic observations with real isolated services. There is no live performance conclusion yet.

## Original sandbox verification (historical, superseded above)

Honest status. The sandbox this was built in had no `node_modules`, no Postgres and no network.

- **Ran and passed** through a minimal stand-in test runner (not vitest): 12 early-radar, 7 topic-pack, 8 extraction / buzz-grouping tests.
- **Strict `tsc`** (no errors) on `entities.ts`, `tokenBuzz.ts`, `topicPacks.ts`, `earlyRadar.ts` and their tests.
- **Syntax-parsed only**, not typechecked or run: `socialTokens.ts`, `tokenResolution.ts`, `narrativeIngestion.ts`, `main.ts`,
  `narrativesMain.ts`, `tregConfig.ts`, and the new tests in `treg.test.ts` (needs zod).
- **Written but never run:** `socialTokens.integration.test.ts` (needs Postgres; its first assertion relies on a hand-computed score of
  about 66 against a 55 threshold, so a failure there may be the test's arithmetic, not the code).
- **Hand-written migration** `0014_token_social_mentions`: verify with the `prisma migrate diff` command in CLAUDE.md, then run
  `prisma generate`. Until generated, `db.tokenMention` does not typecheck.
- **No live Treg, DexScreener or GeckoTerminal call was made.** Whether real posts yield enough mints is unknown.
- Run the integration tests against a **separate** test database, never the application database (see CLAUDE.md).

## Next

1. Deploy the generated outcome migration and collect genuine alert cohorts through seven days. Inspect missingness and sample sizes before considering any threshold changes; outcome tracking itself is now implemented and tested.
2. Safety data for small tokens: LP burned or locked, bundled or sniper wallets, deployer rug history, real dev holding.
3. Holder history series and DexScreener buy/sell counts. Smart-money overlay for small tokens.
4. Pre-graduation pump.fun tokens (needs another source; today only tokens with a pool are visible).
5. An Early Radar screen in `apps/web` (filters, score breakdown, flags, why-excluded).
