# NARRAX — NEAR Research Desk

A research workspace for narrative-driven markets, built on NEAR. NARRAX turns public
conversation and public market data into one evidence-first workspace: what is forming, why it
is moving, and what still needs checking.

This repository is **NEAR-only**. Legacy chain adapters, trading, custody and executor code have
been removed. Research data comes from NEAR token contracts, DEX Screener, GeckoTerminal, NearBlocks
and the configured social provider.

> **Status: NEAR HACKATHON research build.** Narrative ingestion, token discovery, market and holder
> observations, early-radar alerts, AI research analysis, analytics, agent chat, Telegram delivery
> and local access grants work. Nothing signs or sends a transaction.

---

## Hackathon tracks

Entering **Investment Thesis** (`thesis`), **AI Security & Defense** (`security`) and
**Open Innovation** (`open`).

| Track | What the submission shows |
| --- | --- |
| **Thesis** | An evidence-first NEAR ecosystem thesis: attention only matters when it converts into liquidity, distributed ownership, and observed trade flow. The workspace exposes the evidence, the counter-evidence, and the reproducible pipeline behind both. See [`THESIS.md`](./THESIS.md). |
| **Security** | A public, fail-closed risk gate for AI agents: an agent checks token risk before it spends and blocks on `BLOCK` or `UNKNOWN`. NARRAX supplies scam and risk evidence and never holds keys or signs. See [`docs/AGENT_RISK.md`](./docs/AGENT_RISK.md). |
| **Open** | A public research workspace and methodology that does not fit a single category: social narrative → NEP-141 identity → market and holder evidence → written research. |

## Thesis

NARRAX's working thesis is that attention on NEAR becomes durable ecosystem value only when it
converts into measurable on-chain activity: liquidity deep enough to trade, ownership distributed
beyond one wallet, and repeated participation from observed wallets. The workspace is built to test
that claim and to show the evidence against it, not to score conviction. The full claim, limits and
reproduction steps are in [`THESIS.md`](./THESIS.md).

## Agent risk gate

`GET /v1/agent/risk/:mint` is a public, read-only check for AI agents that are about to spend. It
returns `PASS`, `BLOCK` or `UNKNOWN` from fresh market, holder and risk evidence, and fails closed on
missing or stale data. The agent keeps its wallet and keys; NARRAX only supplies scam and risk
evidence and has no signing path. See [`docs/AGENT_RISK.md`](./docs/AGENT_RISK.md) for the contract
and a policy example.

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
- **Agent risk gate**
  - `GET /v1/agent/risk/:mint` — public, fail-closed `PASS` / `BLOCK` / `UNKNOWN` token risk verdict
    for AI agents, with no keys and no signing path; see [`docs/AGENT_RISK.md`](./docs/AGENT_RISK.md)
- **Research workspace** (bilingual EN/ID)
  - narrative radar, token screener and token detail, opportunities, decision analytics,
    personal radar/theses/briefings, alerts, agent chat and admin
  - observed Smart Money wallets and token flows from public NEAR DEX trades, with explicit
    cost-basis and coverage limits
  - server-enforced access tiers and locked navigation
- **Research pipeline**
  - Treg narrative ingestion
  - social token references and narrative-token attribution
  - NEAR NEP-141 metadata, DEX prices/liquidity, holder concentration (GeckoTerminal with a
    NearBlocks fallback) and deterministic risk flags
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
apps/api            read API, auth, local access grants, admin, chat, agent risk gate
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
`NEAR_NETWORK` defaults to **testnet**; mainnet requires an explicit value. The public market-data
providers index mainnet NEAR only, so a research run needs `NEAR_NETWORK=mainnet` and
`NEXT_PUBLIC_NEAR_NETWORK=mainnet`; the testnet default keeps an unset or misspelled value from
ever pointing at mainnet. The API and worker dev scripts load `.env`; the web app reads only
inherited `NEXT_PUBLIC_*` values, so export them before `npm run dev:web`.

## Evidence snapshot

```bash
npm run thesis:report -- --write
```

Rebuilds [`THESIS_EVIDENCE.md`](./THESIS_EVIDENCE.md) from the local Postgres research database:
coverage, narrative-to-token conversion, Early Radar outcomes, smart-money observations and
collection quality. The snapshot is generated; no number in it is hardcoded.

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

## License

MIT. See [`LICENSE`](./LICENSE).
