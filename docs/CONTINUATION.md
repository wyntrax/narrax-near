# Continuation — NARRAX NEAR build

Last updated: 2026-10-20

## Current phase

**Phase 0 complete, plus the first read paths.** The NEAR chain package, the multi-chain host
router, the chain-status API, and the $WYNTRAX access rail are implemented and tested. The
copied research workspace is unchanged; no Solana adapter has been removed yet.

## What changed in this phase

### New: `packages/near`

| File | Purpose |
| --- | --- |
| `src/rpc.ts` | JSON-RPC client (`block`, `query`), timeouts, typed errors, JSON view-call decoding |
| `src/account.ts` | NEAR named/implicit account validation |
| `src/nep141.ts` | `ft_metadata`, `ft_balance_of`, strict parsing, exact amount formatting |
| `src/nep413.ts` | tagged Borsh payload, SHA-256 signable bytes, ed25519 verification, base58 |
| `src/explorer.ts` | NearBlocks account/transaction/token URLs |
| `src/network.ts` | `mainnet`/`testnet` selection, testnet default, default RPC |
| `src/config.ts` | `NEAR_*` env parsing with validation |
| `src/index.ts` | Public exports |

Tests: `src/near.test.ts`, `src/nep413.test.ts`. They inject `fetch` and generate an ed25519
keypair locally, so they need neither network nor wallet.

### New: chain routing

- `packages/shared/src/chains.ts` + `chains.test.ts`
  - `resolveChainFromHost(host, supported)` — `near.<domain>` selects NEAR; apex selects the
    first supported chain; unsupported subdomains fall back to what this build serves.
  - `chainFromSubdomain`, `normalizeHost`, `isChainSubdomain`.
- `apps/web/src/config/chain.ts` — this build supports `['near']`.
- `apps/web/src/middleware.ts` — sets `x-narrax-chain` on the request and response.

### New: chain status API

- `apps/api/src/chain.ts` — public `GET /v1/chain` metadata and `GET /v1/chain/status`
  freshness probe. The probe is injected; a missing or failing probe returns 503 without
  leaking the RPC URL or upstream error text.
- `apps/api/src/chain.test.ts` — metadata, height/latency, missing probe, failing probe.
- `apps/api/src/server.ts` — registers the routes with `nearConfigFromEnv()` + `NearRpc`.
- Admin connections list reports `near-rpc`.

### New: $WYNTRAX access (webhook primary + direct SPL fallback)

The Solana $WYNTRAX holding remains the source of truth. The NEAR deployment does not call the
private Solana app or share its database.

1. **Primary:** the existing signed Wyntrax membership webhook
   (`POST /v1/integrations/wyntrax/events`). The issuer sends the same event to both
   deployments; events stay keyed by `chain: "solana"` and the user's Solana wallet. The user
   links that wallet here, so `resolveEntitlements` matches the membership exactly as on Solana.
2. **Fallback:** `apps/api/src/entitlements/holdings.ts` reads the linked Solana wallet's SPL
   balance and maps it to the same admin-configured tiers. It is only consulted when no active
   membership exists and no revocation applies to that wallet, is disabled unless
   `WYNTRAX_RPC_URL` is set, caches balances for 5 minutes, checks at most 8 wallets, and fails
   closed on every RPC error.
   - `packages/shared/src/entitlements.ts` accepts an optional `HoldingEntitlement` and adds a
     `WYNTRAX` source with no expiry. It cannot be used by an admin (the admin source stands
     alone) and the wallet must be linked and verified.
   - `apps/api/src/entitlements/access.ts` reads the holding before the repeatable-read
     transaction (no RPC inside a DB transaction), skips it when the webhook has an active
     membership, then re-checks the link and membership inside the transaction.
   - The `min_entitlement_age_hours` gate uses the wallet link's `verifiedAt` for a direct
     holding, since there is no membership start date to age.
   - `apps/api/src/server.ts` enables the fallback only when `WYNTRAX_RPC_URL` is set;
     `WYNTRAX_MINT` is a fallback for an unsaved `access.token_mint`. The admin connections
     list reports `wyntrax-webhook` and `wyntrax-holdings`.
   - `apps/api/src/entitlements/holdings.test.ts` covers thresholds, decimals, multiple
     wallets, caching, tier changes, RPC failure, invalid mints, and Token-2022 fail-closed.
   - `apps/api/src/entitlements/gating.test.ts` covers the primary/fallback ordering.
   - `apps/api/src/entitlements/isolation.test.ts` still enforces the entitlement boundary: the
     holdings module has a local two-method RPC interface and does not import `@narra/solana`.

**Solana-side changes: none.** Operations only:
- point the Wyntrax webhook at the NEAR API and set `WYNTRAX_WEBHOOK_SECRET` (and the previous
  secret during rotation);
- link the same Solana wallet on the NEAR domain;
- for the fallback, set `WYNTRAX_RPC_URL`, and either save the same `access.token_mint` /
  `access.tier_requirements` in the NEAR admin or set `WYNTRAX_MINT` plus those tier amounts.

Research data remains NEAR-only. The Solana read here is an identity/entitlement check, not
Solana market data.

### Changed

- `packages/shared/src/brand.ts` — default name is `NARRAX`.
- `packages/shared/src/index.ts` — exports the chain registry.
- root `package.json` — name `narrax-near`.
- `.env.example` — NEAR-first template (`NEAR_NETWORK`, `NEAR_RPC_URL`,
  `NEAR_EXPLORER_URL`), plus the Wyntrax webhook secrets and the optional direct SPL fallback
  (`WYNTRAX_RPC_URL`, `WYNTRAX_MINT`, `WYNTRAX_HOLDING_CACHE_SECONDS`); testnet default.
- `README.md` — hackathon-facing overview, honest status, tracks, run/test instructions.
- `CLAUDE.md` — project rules for future agents.
- `docs/PORTING.md` — chain mapping, phases, acceptance criteria, known unknowns.

### Removed from the copy

- `.git` worktree pointer (the copy is a fresh project)
- `narra-full.zip`, `vitest-results.json`
- `apps/web/.next-e2e` generated chunks
- secrets/local scripts (`.env`, `.env.local`, `local-*.ps1`) — the original repo keeps them

## Verification

Verified on 2026-10-20:

- `npm ci --no-audit --no-fund` — 1,412 packages. Install scripts are blocked in this
  environment, so `npx prisma generate --schema packages/database/prisma/schema.prisma` was
  run manually (client v6.19.3).
- `npm run typecheck` — pass (root `tsc` + `@narra/web`).
- `npx vitest run apps/api/src/chain.test.ts packages/near packages/shared/src/chains.test.ts`
  — **45 passed** (4 files).
- `npx vitest run packages/shared` — **65 passed** (8 files).
- `npx vitest run apps/api/src/entitlements/holdings.test.ts packages/shared/src/entitlements.test.ts`
  — **26 passed** (16 pure entitlement + 10 holdings).
- `npx vitest run apps/api/src/entitlements/gating.test.ts` against the isolated test database —
  **40 passed**, including the webhook-primary/direct-fallback ordering test.
- `npx vitest run packages/shared apps/api/src/entitlements` against the isolated Postgres/Redis
  — **23 files / 274 tests passed**.
- `npm test -w @narra/web` — **37 files / 559 tests passed**.
- Live read-only testnet probe (`npm run near:status -- testnet`) — block **273895681**, hash
  `inTwRCTWJWxbFZiFdXCAbruVVzyEQjrDqH6ZFBtiqLq`, account `testnet` balance
  **1,061,784.36022878493448650552294 NEAR**, explorer URL generated. Cold RPC latency ~3.7 s.
- Full backend suite — **not run**: it needs the isolated Postgres/Redis pair; without them
  integration tests skip, and the run is not a full verification.

Not verified: real wallet signing, Privy/NEAR behavior, a production build, the API route
against a running server (the route is covered by Fastify injection tests), the direct SPL
fallback against a real Solana RPC/mint (tests use a fake RPC), and a real Wyntrax webhook
delivery to this deployment.

## Decisions

- Brand: **NARRAX**; repository `narrax-near`.
- Multi-chain: apex → Solana in production; `near.<domain>` → this build. This repository
  implements only NEAR and passes `['near']` to the router.
- Data: NEAR-only. Solana adapters remain temporarily so the copied shell compiles; they are
  removed before submission.
- Settlement: NEAR **testnet** only, and only in Phase 4 after a separate security review.
- Entitlements: **no custom contract**. Signed Wyntrax webhook is primary; an optional
  read-only SPL balance check is the fallback. The $WYNTRAX Solana token remains the source of
  truth, and the Solana app needs no code change.
- Tracks: thesis, security, nfts, memecoins.

## Next

1. Configure the Wyntrax webhook to deliver to this deployment and link a Solana wallet on the
   NEAR domain; then run one real end-to-end membership check.
2. Phase 1: NEAR read path (account/NEP-141 balances, token metadata, chain-backed pages).
3. Exercise the direct SPL fallback once against a real mainnet RPC and the real mint (read-only,
   no signing).
4. Verify the live unknowns listed in `docs/PORTING.md` (RPC behavior, indexers, pricing
   coverage, wallet signature encoding, NearBlocks paths).
5. Only then start Phase 2 ingestion.

## Open questions for the owner

- Which NEP-171 collection (if any) should demonstrate the NFTs track?
- Which testnet account will be the allowlisted settlement account?
- Demo domain: is `near.narrax.xyz` available, or should the hackathon deployment use a
  separate host?

## Constraints that must not regress

- No mainnet signing, spending, or deployment.
- The executor stays dry-run unless Phase 4 is explicitly approved.
- Server-side authorization; URL manipulation must not bypass gates.
- Tests never use the application database or Redis.
- The only Solana read allowed is the read-only $WYNTRAX entitlement fallback; no Solana
  research data enters this build.
- No fabricated chain evidence.
- No push or public release without human confirmation.

## Upstream merge from the Solana repository (2026-11-04)

Merged the chain-agnostic work from `narra-entitlements` `origin/main` (`ee19106`) while keeping
this build NEAR-only. The merged surface is:

- **Private Pro research workspace**: personal radar, thesis tracker and daily briefing;
  shared schemas, API routes, BullMQ queue/worker, Prisma models and migration, web pages,
  navigation, feature tiers and admin labels. Token identifiers are validated as NEAR account
  ids (`isNearAccountId`), not Solana mints.
- **Community join gate**: three local community steps unlock the early-access join button.
  The old Wyntrax membership checkbox and the `waitingSync`/`syncExpired` states were replaced
  by silent entitlement polling, which also picks up this build's existing read-only holding
  fallback.
- **Admin entitlement policy**: entitlement transactions now use the same environment/database
  admin decision as the HTTP layer (`decideIsAdmin`).
- **Admin dashboard tabs**: Access, Tiers & features, Research and Runtime are separate panels.
- **Analytics coverage clarity**: action/window-scoped summary, signals and outcome pages,
  explicit pending / unknown / unmeasured counts, and no trading-cost assumption for non-buy
  actions.
- **Market coverage diagnostics**: DEX Screener omission reasons, per-lane price request
  counters, retained daily/latest diagnostics, and the read-only `npm run research:coverage`
  audit. This repo's existing outcome/discovery/launch/unpriced/general lanes are instrumented;
  the social lane remains empty because this build does not run the Solana social-priority
  scheduler.

Deliberately not merged (Solana-only or dependent on Solana chain adapters): wallet research,
manual swaps/trading, smart-money investigation and ranking, Wyntrax holding/membership worker
sync, Solana transaction verification/lookup tables, Helius/RPC holder and market-price fixes,
Jupiter changes, and the Solana-specific deployment/CI files.

Verification after the merge:

- `npm run typecheck` passes (root + web).
- `npx vitest run packages/shared packages/near packages/queue packages/smart-money packages/analytics`
  passes (queue integration tests skipped without test Redis).
- `npm test -w @narra/web` passes (39 files, 508 tests).
- `npm run build -w @narra/web` completes; the production auth scan passes.
- `npx prisma validate` passes with a dummy `DATABASE_URL`.
- The CI backend sequence (`prisma migrate deploy`, migration drift check, full `vitest run`,
  `check-test-results.mjs`) passes against isolated Postgres/Redis: **1,415 tests, 0 skipped**.
- `.github/workflows/ci.yml` now runs static checks, backend migrations/tests, web tests/build,
  and the Docker image and migration smoke test. `security.yml` adds npm audit, gitleaks and
  optional CodeQL. `release.yml` publishes an image only when `PUBLISH_ENABLED=true`; it has no
  deployment jobs because this repository does not include the Solana deploy scripts.