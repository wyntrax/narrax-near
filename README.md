# NARRAX — NEAR Research Desk

A research workspace for narrative-driven markets, built on NEAR. NARRAX turns public
conversation and public market data into one evidence-first workspace: what is forming, why it
is moving, and what still needs checking.

This repository is **NEAR-only**. Legacy chain adapters, trading, custody and executor code have
been removed. Research data comes from NEAR token contracts,
DEX Screener, GeckoTerminal and the configured social provider.

> **Status: hackathon research build.** Narrative ingestion, token discovery, market and holder
> observations, early-radar alerts, AI research analysis, analytics, agent chat, Telegram delivery
> and local access grants work. Nothing signs or sends a transaction.

---

## Hackathon tracks

| Track | What the submission shows |
| --- | --- |
| **Thesis** | Narrative radar: stages, velocity, evidence, and a written thesis per token — not a price prediction. |
| **Open** | Public research guides, a reproducible local interface, and an evidence-first methodology. |
| **Memecoins** | NEAR token discovery, screener, early-radar gates, holder concentration and risk flags. |

## What works today

- **NEAR chain package** (`packages/near`)
  - JSON-RPC client with timeouts and typed errors
  - account-id validation (named + 64-hex implicit accounts)
  - NEP-141 `ft_metadata` / `ft_balance_of` with strict parsing
  - NEP-413 payload construction, SHA-256 signable bytes, ed25519 verification
  - NearBlocks explorer URLs and network config (`testnet` by default)
- **Read-only chain API**
  - `GET /v1/chain` — network and explorer metadata
  - `GET /v1/chain/status` — latest final block height and measured latency; fails closed
    with 503 when the probe is unavailable
- **Research workspace** (bilingual EN/ID)
  - narrative radar, token screener and token detail, opportunities, decision analytics,
    personal radar/theses/briefings, alerts, agent chat and admin
  - observed Smart Money wallets and token flows from public NEAR DEX trades, with explicit
    cost-basis and coverage limits
  - server-enforced access tiers and locked navigation
- **Research pipeline**
  - Treg narrative ingestion
  - social token references and narrative-token attribution
  - NEAR NEP-141 metadata, DEX prices/liquidity, holder concentration and deterministic risk flags
  - observed wallet trades, token flows and average-cost Smart Money profiles from public DEX trades
  - Early Radar alerts and measured outcomes
  - AI opportunity analysis and outcome tracking
  - a public landing snapshot of aggregate narrative, token and opportunity counts
- **Delivery**
  - in-app notifications, WebSocket realtime events, and optional Telegram global research alerts

## Access

Sign-in is handled by Privy with **email or Google**. No browser wallet connection is requested.
Access is granted locally by an admin early-access grant; there is no token-holding or
membership-webhook gate. The available tiers are `EARLY_ACCESS`,
`MEMBER` and `PRO`; only `EARLY_ACCESS` is granted by the current admin UI. Access tokens are
checked against the configured Privy verification key, with a cached fallback to the app JWKS
endpoint (`PRIVY_JWKS_URL`, or Privy's documented default) when a key has been rotated.

Set `ADMIN_PRIVY_USER_ID` or `ADMIN_EMAIL` in the server environment to make an account an
admin. When either is set, the database admin flag is ignored.

## Architecture

```
apps/web            Next.js research workspace (EN/ID)
apps/api            read API, auth, local access grants, admin, chat
workers/pipeline    narratives, tokens, market data, outcomes, alerts, Telegram
packages/near       NEAR RPC, NEP-141, NEP-413, explorer, network config
packages/shared     chain routing, access policy, brand, env checks
packages/database   Prisma schema and client
```

## Run locally

Requirements: Node 22+, Postgres 16, Redis 7+ (Redis Streams are required).

```bash
cp .env.example .env
# fill DATABASE_URL, REDIS_URL, Privy values and an AI key if you want chat/analysis
npm install
npx prisma generate
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm run dev:api        # API on :4000
npm run dev:web        # web on :4010
npm run dev:workers    # research pipeline
```

The NEAR defaults are read from `NEAR_NETWORK`, `NEAR_RPC_URL`, and `NEAR_EXPLORER_URL`.
`NEAR_NETWORK` defaults to **testnet**; mainnet requires an explicit value.

## Test

```bash
# isolated local Postgres and Redis
export DATABASE_URL=postgresql://postgres:...@localhost:5432/narra_ci_test
export NARRA_TEST_DATABASE_NAME=narra_ci_test
export NARRA_TEST_REDIS_URL=redis://localhost:6379/15
npm test
npm run typecheck
```

## Boundaries

- Research only. The codebase contains no signing, order, custody, portfolio or executor path.
- A fresh price, holder row or risk flag is an observation, not a safety or return guarantee.
- Missing data stays unknown; it is never replaced with zero.
- Social text is untrusted input and is sanitized before storage or display.
