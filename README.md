# NARRAX — NEAR Research Desk

A research workspace for narrative-driven markets, built on NEAR. NARRAX turns public
conversation, on-chain activity, and market data into one evidence-first workspace: what is
forming, why it is moving, and what still needs checking.

This repository is the **NEAR deployment** of NARRAX. The product shell (research workspace,
entitlements, admin, risk governor, paper trading, bilingual EN/ID UI) is shared with the
original build. The chain layer is being ported from Solana to NEAR, one vertical slice at a
time.

> **Status: Phase 0 + first read paths.** The NEAR chain package (RPC, NEP-141 tokens, NEP-413
> signing, explorer links, network config), the multi-chain host router, the chain-status API,
> and the $WYNTRAX access rail are implemented and tested. Research ingestion, pricing, and
> settlement are the next phases. See [`docs/PORTING.md`](docs/PORTING.md) for the exact plan
> and what is not done yet.

---

## Why NEAR

- **Fast finality and low fees** make a public research desk usable without a gas budget.
- **NEP-141 / NEP-171** are simple, composable token standards for memecoins and membership NFTs.
- **NEP-413 message signing** gives wallet proof without a transaction.
- **NEAR Intents** lets the same product route a trade across chains later, without pretending
  every asset lives on one chain.

## Hackathon tracks

| Track | What the submission shows |
| --- | --- |
| **Thesis** | Narrative radar: stages, velocity, evidence, and a written thesis per token — not a price prediction. |
| **Security** | A risk governor on every order, paper-first execution, no signing keys in the executor, and an auditable decision ledger. |
| **NFTs** | Membership NFTs as the entitlement primitive: hold the pass, unlock the research tier. |
| **Memecoins** | Token screener and smart-money research on NEAR-native venues, with liquidity and holder floors shown honestly. |

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
- **Multi-chain host routing** (`packages/shared/src/chains.ts`)
  - apex domain → the original chain; `near.<domain>` → NEAR
  - unsupported subdomains fall back to the chain this build actually implements
- **The NARRAX research workspace** (unchanged UI, bilingual EN/ID)
  - radar, tokens, opportunities, smart money, screener, portfolio, settings, admin
  - server-enforced entitlements, locked navigation, and an access card
  - paper-trading controls; live execution is read-only by design

## Access: holding $WYNTRAX

The Solana $WYNTRAX token stays the source of truth. This deployment has two ways to read it:

1. **Primary — signed Wyntrax membership webhook** (`POST /v1/integrations/wyntrax/events`).
   The issuer sends the same event to the Solana and NEAR deployments; the user links the same
   Solana wallet here. The webhook secret is `WYNTRAX_WEBHOOK_SECRET`.
2. **Optional fallback — direct SPL balance** (`WYNTRAX_RPC_URL` plus `access.token_mint` or
   `WYNTRAX_MINT`). Read-only, cached, and only consulted when no active membership exists.
   Disabled when `WYNTRAX_RPC_URL` is blank. It uses the same admin tier amounts
   (default 500,000 / 1,000,000).

No code change is needed in the Solana app. Point the Wyntrax webhook at this deployment, link
the Solana wallet here, and, for the fallback, copy the mint and tier settings. The research
data path remains NEAR-only; this is an identity check, not Solana market data.

## Not done yet (do not mistake for shipped)

- NEAR swap/trade ingestion and wallet discovery
- NEAR token pricing, liquidity, and holder data
- NEP-171 membership entitlement checks
- NEAR wallet linking and NEP-413 sign-in in the web app
- NEAR testnet settlement through the executor
- Removal of the legacy Solana adapters from this copy

The README will be updated as each phase lands. Nothing here claims mainnet readiness.

## Architecture

```
apps/web        Next.js research workspace (EN/ID), chain-aware shell
apps/api        read API, auth, entitlements, admin, paper trades
workers/pipeline  narratives, discovery, scoring, market data
workers/executor  dry-run order path; cannot sign or send
packages/near   NEAR RPC, NEP-141, NEP-413, explorer, network config
packages/shared chain routing, entitlements, brand, env checks
packages/risk   risk governor and limits
packages/database Prisma schema and stores
```

The chain layer is deliberately a **port**, not an if-chain: `packages/near` exposes typed
primitives, and the pipeline/API consume those primitives through the same interfaces the rest
of the product already uses.

## Run locally

Requirements: Node 22+, Postgres 16, Redis 7.

```bash
cp .env.example .env
# fill DATABASE_URL, REDIS_URL, and the auth/AI keys you have
npm install
npx prisma generate
npm run dev:api        # API on :4000
npm run dev:web        # web on :4010
npm run dev:workers    # research pipeline
```

The NEAR defaults are read from `NEAR_NETWORK`, `NEAR_RPC_URL`, and `NEAR_EXPLORER_URL`.
`NEAR_NETWORK` defaults to **testnet**; mainnet requires an explicit value.

## Test

```bash
npm test                                   # backend + packages
npm test -w @narra/web                     # web
npm run typecheck                          # root + web
```

The NEAR package tests use an injected `fetch` and a locally generated ed25519 keypair, so they
do not touch the network or a real wallet.

## Security posture

- The executor is **dry-run only**. It refuses to start if a signing key variable is present.
- Manual portfolio controls are **paper-only**: preview → acknowledge → confirm, with a
  server-owned ticket, expiry, and the same risk governor as automated orders.
- Entitlements are enforced on the server. Hiding a route in the UI is never the control.
- Wallet proof is a **message signature** (NEP-413), not a transaction.
- Secrets stay server-side; `.env` is ignored and never committed.

## Hackathon compliance

- Build window: **1–14 November 2026**. Submission deadline: **14 November 2026, 23:59 UTC**.
- The repository is public, with no API keys, private keys, or generated artifacts.
- The demo uses **NEAR testnet** only. No mainnet signing, spending, or deployment.
- One submission; the human team writes and publishes the demo post.

## Repository layout

```
apps/            web + API
workers/         pipeline + executor
packages/        near, shared, risk, database, ai, queue, realtime, ...
docs/            porting plan, operations, product notes
scripts/         local tooling
```

## License

No license file yet. Treat the code as source-available for the hackathon review until the
team adds one.
