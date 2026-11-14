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

![NARRAX landing page](./docs/screenshots/landing.png)

## Judge quickstart

The public path needs **Node 22 + Postgres 16**. No Privy, wallet, Redis or AI key is required.

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
DEMO_SEED_CONFIRM=yes npm run demo:seed
npm run demo:refresh
npm run dev:api:public
```

In a second terminal:

```bash
export NEXT_PUBLIC_API_URL=http://localhost:4000
export NEXT_PUBLIC_SITE_URL=http://localhost:4010
npm run dev:web
```

PowerShell: set those two variables with `$env:NAME='value'` instead of `export`.

For the seed step on PowerShell:

```powershell
Copy-Item .env.example .env
$env:DEMO_SEED_CONFIRM='yes'
npm run demo:seed
npm run demo:refresh
```

Then verify the public judge path:

1. Open `http://localhost:4010/thesis` (or `http://localhost:4000/v1/public-thesis-desk`) to inspect the keyless H1/H2 narrative-to-token conversion funnel, watched NEAR narratives, non-bridged NEP-141 token evidence (`Fresh` / `Stale` / `Missing`), and anonymized aggregate smart-money DEX flows, with direct links into the risk gate.
2. Open `http://localhost:4010/agent-risk` and click **Use example** — you should see `PASS` for `nearly-993927.nearlytrade.near` (NEARLY) with 2,680 holders, 19.1% top-10 concentration, verified NEP-141 `ft_metadata`, and 0 full-access keys.
3. Open `http://localhost:4010/` for the landing snapshot.

`demo:seed` replaces the research tables in the target database, so point `DATABASE_URL` at a demo
database, not production. `demo:refresh` then fetches current public market, holder and risk evidence
for the seeded tokens; without it a dated seed ages out of the freshness window and the gate correctly
returns `UNKNOWN`. It never shifts timestamps or invents a value. The authenticated workspace
(`/app/...`), including the `/app/agent` research chat, requires a Privy app and an AI provider key; it
is shown in the demo video. Full judge checklist: [`docs/JUDGE.md`](./docs/JUDGE.md).

---

## Hackathon tracks

Entering **Investment Thesis** (`thesis`), **AI Security & Defense** (`security`) and
**Open Innovation** (`open`).

| Track | What the submission shows |
| --- | --- |
| **Thesis** | An evidence-first NEAR ecosystem thesis: attention only matters when it converts into liquidity, distributed ownership, and observed trade flow. The keyless [`/thesis`](http://localhost:4010/thesis) desk (`GET /v1/public-thesis-desk`), [`THESIS_EVIDENCE.md`](./THESIS_EVIDENCE.md) and [`THESIS_CONTEXT.md`](./THESIS_CONTEXT.md) expose the evidence, the counter-evidence, and the reproducible pipeline behind both. See [`THESIS.md`](./THESIS.md). |
| **Security** | A public, fail-closed risk gate for AI agents: an agent checks token risk before it spends and blocks on `BLOCK` or `UNKNOWN`. It verifies the target is a deployed contract (including a global contract), not an EOA or deleted account, and reports full-access keys as a warning. NARRAX supplies scam and risk evidence and never holds keys or signs. See [`docs/AGENT_RISK.md`](./docs/AGENT_RISK.md). |
| **Open** | A public research workspace and methodology that does not fit a single category: social narrative → NEP-141 identity → market and holder evidence → written research. |

## Thesis & public thesis desk

NARRAX's working thesis is that attention on NEAR becomes durable ecosystem value only when it
converts into measurable on-chain activity: liquidity deep enough to trade, ownership distributed
beyond one wallet, and repeated participation from observed wallets. The workspace is built to test
that claim and to show the evidence against it, not to score conviction. The full claim, limits and
reproduction steps are in [`THESIS.md`](./THESIS.md).

`GET /v1/public-thesis-desk` and the keyless `/thesis` web page expose the live thesis without an
account:
- **H1 / H2 conversion funnel**: active watched narratives (`12` topics across X), bridged quote
  assets explicitly excluded (`*.omft.near`, `*.omdep.near`, `*.bridge.near`), native NEP-141 tokens
  discovered, narrative-linked tokens, holder coverage, and tokens passing the `$20k` liquidity + `50`
  holder confirmation floors.
- **Native NEAR token evidence**: ranked contracts with `Fresh` / `Stale` / `Missing` evidence tags
  (stale or missing evidence never counts as meeting floors) and direct links to `/agent-risk?mint=...`.
- **Observed DEX wallet flow (aggregate)**: anonymized DEX swap statistics across NEAR pools
  (wallet counts by `QUALIFIED` / `PROVISIONAL` / `INSUFFICIENT`, observed swaps, total DEX volume,
  and per-token net buy/sell flows) with zero individual wallet addresses or transaction hashes exposed.

![Public thesis desk showing funnel, narratives, native token evidence, and aggregate smart-money flow](./docs/screenshots/thesis-desk.png)

## Agent risk gate

`GET /v1/agent/risk/:mint` is a public, read-only check for AI agents that are about to spend. It
returns `PASS`, `BLOCK` or `UNKNOWN` from fresh market, holder and risk evidence, and fails closed on
missing or stale data. It also verifies that the account is a deployed contract—not an EOA or a
deleted account—and reports full-access key counts as a warning. The agent keeps its wallet and keys;
NARRAX only supplies scam and risk evidence and has no signing path. The public `/agent-risk` web
page exposes the same check with a token input. See [`docs/AGENT_RISK.md`](./docs/AGENT_RISK.md) for
the contract and a policy example.

![Agent risk gate showing a PASS verdict](./docs/screenshots/agent-risk-pass.png)

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
- **Public thesis desk**
  - `GET /v1/public-thesis-desk` and `/thesis` — keyless conversion funnel, watched narratives,
    non-bridged NEP-141 token evidence with freshness checks, and anonymized aggregate smart-money
    DEX flows linking directly to `/agent-risk`
- **Agent risk gate**
  - `GET /v1/agent/risk/:mint` - public, fail-closed `PASS` / `BLOCK` / `UNKNOWN` token risk verdict
    for AI agents, with no keys and no signing path; includes contract existence and access-key facts;
    see [`docs/AGENT_RISK.md`](./docs/AGENT_RISK.md)
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
  - bridged assets (`*.omft.near`, `*.omdep.near`, `*.bridge.near`) are excluded from narrative
    links and launch candidates
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

The NEAR macro backdrop is separate and keyless:

```bash
npm run thesis:context -- --write
```

It rebuilds [`THESIS_CONTEXT.md`](./THESIS_CONTEXT.md) and its chart from DefiLlama, CoinGecko,
NearBlocks and NEAR mainnet RPC. It is the slow macro clock, not a price prediction.

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

## Hackathon baseline, diff and disclosures (Q-002 / Q-003 / Q-005)

Per `HACKATHON.md` (`Q-001`, `Q-002`, `Q-003`, `Q-005`):

- **Baseline disclosure (`Q-002`, `Q-003`)**: NARRAX originated as a research workspace on another chain. Commit `2f32ed6` (tagged `hackathon-baseline` and `pre-hackathon`) is the initial port baseline; all legacy chain adapters, trading, custody, portfolio and executor surfaces were stripped during the hackathon window (`745b983`). Only the NEAR-native architecture, thesis pipeline and agent risk gate built during the hackathon window are submitted for evaluation.
- **Hackathon diff (`Q-003`)**:
  - Baseline tag: `pre-hackathon` / `hackathon-baseline` (`2f32ed6`)
  - Submission tag: `hackathon-submission` (`main`)
  - Compare diff: [`hackathon-baseline...main`](https://github.com/wyntrax/narrax-near/compare/hackathon-baseline...main) (or [`pre-hackathon...hackathon-submission`](https://github.com/wyntrax/narrax-near/compare/pre-hackathon...hackathon-submission))
- **Built during the NEAR Hackathon window**:
  - `@narra/near` (`packages/near`): NEAR JSON-RPC client, account-id validation (named + 64-hex implicit), NEP-141 `ft_metadata` / `ft_balance_of`, NEP-413 message signing/verification, NearBlocks explorer helpers and network config.
  - **AI Security & Defense (`security`)**: Public fail-closed agent risk gate (`GET /v1/agent/risk/:mint`, `/agent-risk` web UI, `scripts/agent-risk.ts` CLI) with live NEAR RPC contract code verification (`code_hash` + `global_contract_hash`) and access-key inspection (`fullAccessKeys` vs. `functionCallKeys`).
  - **Investment Thesis (`thesis`)**: Keyless public thesis desk (`GET /v1/public-thesis-desk` + `/thesis` web UI with H1/H2 funnel, freshness-gated native tokens, and anonymized aggregate smart-money DEX flows), reproducible NEAR thesis evidence generator (`scripts/thesis-report.ts` → `THESIS_EVIDENCE.md` + `THESIS_EVIDENCE.svg`), keyless NEAR macro context generator (`scripts/thesis-context.ts` → `THESIS_CONTEXT.md` + `THESIS_CONTEXT.svg`), NearBlocks holder concentration fallback (`packages/market-data/src/nearblocks.ts`), and bridged-asset (`*.omft.near`, `*.omdep.near`, `*.bridge.near`) cohort exclusions.
  - **NEAR Smart Money & Public Judge Path**: Observed NEAR DEX wallet flow accounting (`workers/pipeline`, `apps/api/src/smartMoney.ts`), Telegram Early Radar delivery, and the keyless 5-minute public judge demo (`demo:seed`, `demo:refresh`, `dev:api:public`).
- **Libraries and tooling disclosure (`Q-005`)**:
  - Open-source packages: Next.js 15, React 19, Fastify, Prisma (PostgreSQL), ioredis / BullMQ, `@privy-io/react-auth`, TanStack Query, Radix UI, Tailwind CSS, Zod, Vitest, Playwright.
  - Public data APIs: NEAR JSON-RPC, NearBlocks, DEX Screener, GeckoTerminal, DefiLlama, CoinGecko, Treg.
  - AI coding assistance: Claude Code and Gemini / Antigravity were used during development and testing.

## License

MIT. See [`LICENSE`](./LICENSE).
