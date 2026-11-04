# Porting NARRAX to NEAR

This document is the working plan for the NEAR deployment. It records what is implemented,
what is deliberately deferred, and the facts that still need verification against live NEAR
infrastructure. Update it as each phase lands.

## Goal

Ship a NEAR-native research desk that a judge can open, understand, and verify:

1. **Read** NEAR market and social data.
2. **Explain** a narrative thesis with evidence and explicit uncertainty.
3. **Protect** every order with a risk governor and a paper-first path.
4. **Settle** on NEAR **testnet** only.

## Non-goals for the hackathon

- Mainnet deployment, mainnet signing, or real funds.
- A 1:1 clone of every Solana feature.
- Custom smart contracts (see the entitlement constraint below).
- A trading bot that promises returns. NARRAX is a research tool.

## Chain mapping

| Concern | Solana build | NEAR build |
| --- | --- | --- |
| RPC | Helius JSON-RPC | `https://rpc.testnet.near.org` (`packages/near/src/rpc.ts`) |
| Account identity | base58 ed25519 address | named account or 64-hex implicit account (`account.ts`) |
| Token standard | SPL Token | NEP-141 (`nep141.ts`) |
| NFT standard | Metaplex | NEP-171 (read-only) |
| Wallet proof | `signMessage` | NEP-413 (`nep413.ts`) |
| Explorer | Solscan | NearBlocks (`explorer.ts`) |
| Swap source | Helius enhanced transactions | NEAR RPC receipts / indexer (planned) |
| Pricing | Jupiter + DexScreener + GeckoTerminal | Ref/Rhea quotes + DexScreener/GeckoTerminal where covered (verify) |
| Settlement | Solana executor (dry run) | NEAR testnet executor (planned, separate signer) |

## Entitlement constraint: no custom contract

The owner decision is **no custom contract**. That rules out deploying a bespoke membership
contract for the demo.

**Chosen source of truth:** the **$WYNTRAX Solana token**. The NEAR deployment receives the same
signed Wyntrax membership events as the Solana app, keyed by the user's linked Solana wallet
(`chain: "solana"`). An optional read-only SPL balance check is the fallback when no active
membership exists. This is an identity/entitlement check, not Solana research data, and it needs
no change in the Solana app. See `docs/CONTINUATION.md` for the operational steps.

The NEAR-native options below remain for the NFTs track or a future membership asset; they are
not the current source of truth:

1. **Server-issued seats** (already implemented): early access, admin-granted tiers, expiries.
   This needs no chain interaction and is the fallback for the demo.
2. **Read-only NEP-141 threshold**: `ft_balance_of` against an existing token contract. Cheap,
   but the token choice must be defensible (not a fabricated "membership token").
3. **Read-only NEP-171 collection**: `nft_tokens_for_owner` against an existing collection, if
   the team picks one. No minting contract is written by us.

Do not describe a membership NFT as shipped until one of these is wired and verified.

## Phases

### Phase 0 — foundation (done)

- [x] `packages/near`: RPC client, NEP-141 metadata/balance, NEP-413 sign/verify, explorer,
      network config, account validation.
- [x] `packages/shared/src/chains.ts`: apex/subdomain routing.
- [x] NEAR-first `.env.example`, README, porting plan.
- [x] Unit tests with injected fetch and a generated ed25519 keypair.
- [x] Typecheck and test baseline for the copied workspace.

**Acceptance:** `npm test -w @narra/near` passes without network access; typecheck passes.

### Phase 1 — NEAR read path

- [ ] Replace the Solana RPC dependency in `apps/api` health and wallet reads with `NearRpc`.
- [ ] Add a `near` chain adapter behind the existing data interfaces.
- [ ] Token metadata resolution for NEAR contracts (cache + validation).
- [ ] Wallet balances in NEAR/yoctoNEAR and NEP-141 tokens.
- [x] API route for chain status (`network`, latest final block, RPC latency).
- [ ] Integration test against testnet RPC, skipped without `NEAR_RPC_URL`.

**Acceptance:** the app shows a real testnet account, its NEAR balance, and one NEP-141
balance; no Solana code runs on the NEAR path.

### Phase 2 — research data

- [ ] Swap ingestion from NEAR receipts (or a vetted indexer) into the existing trade model.
- [ ] Wallet discovery and first-seen tracking, with the same bounded backfill and idempotency.
- [ ] Pricing: Ref/Rhea quote path plus DexScreener/GeckoTerminal coverage checks.
- [ ] Narrative linking for NEAR tokens; keep the existing evidence floors unchanged.
- [ ] Data Health checks for NEAR (RPC lag, indexer gap, unpriced tokens).

**Acceptance:** at least one NEAR memecoin has stored trades, a price, liquidity, holder
count, and a narrative link that a judge can verify on NearBlocks.

**Open verification:** Does DexScreener cover NEAR pools? Does GeckoTerminal? What are the Ref
Finance and Rhea quote endpoints and rate limits? Which indexer offers receipt-level swaps
without a custom contract?

### Phase 3 — wallet auth and entitlements

- [ ] Replace/augment Privy with NEAR wallet selection (Wallet Selector or FastAuth).
- [ ] NEP-413 challenge flow: server nonce, recipient check, single-use nonce store.
- [x] Cross-chain $WYNTRAX entitlement source: signed webhook primary, direct SPL fallback.
- [ ] Read-only NEAR membership check for the NFTs track (server seats, NEP-141, or NEP-171).
- [ ] Keep the existing server-side authorization; the UI lock is presentation only.

**Acceptance:** a testnet wallet signs a NEP-413 message, the server verifies it, and a
replayed nonce is rejected. A user without access cannot reach a gated route by URL.

**Open verification:** Privy's NEAR support; Wallet Selector package versions; FastAuth
availability; which wallets return standard base64 signatures.

### Phase 4 — testnet settlement

- [ ] A separate testnet-only signer path. The current executor stays dry-run by default and
      refuses a signing key.
- [ ] Explicit `NEAR_EXECUTION_NETWORK=testnet` guard plus an allowlist and per-order caps.
- [ ] Risk governor and paper-fill parity before any real testnet transfer.
- [ ] Receipt confirmation, idempotency, and a visible audit trail.
- [ ] Security review of key handling, replay, and failure modes before enabling.

**Acceptance:** one allowlisted testnet account completes a small transfer; the ledger records
the receipt; mainnet is impossible by configuration.

**Do not start this phase without explicit owner approval.** The hackathon rules forbid mainnet
spending; testnet is allowed, but the signer design still needs review.

### Phase 5 — submission polish

- [ ] Remove legacy Solana adapters from this repository.
- [ ] Rewrite remaining Solana copy in EN/ID messages.
- [ ] Demo script: open desk → radar → token thesis → risk check → paper close → testnet receipt.
- [ ] Public repo hygiene: no secrets, no commercial private context, no generated artifacts.
- [ ] README, 3-minute video outline, and submission text.

## Multi-chain host routing

The production product keeps the apex domain on Solana and mounts other chains on subdomains:

```
narrax.xyz          -> solana (commercial build)
near.narrax.xyz     -> near   (this build)
```

`resolveChainFromHost(host, supported)` is pure and tested. This repository passes
`['near']` as the supported list, so an apex request falls back to NEAR instead of trying to
serve a chain that is not present. The Next.js middleware and the API should both call the same
function; do not duplicate host parsing.

## Testing rules

- Unit tests must not touch the network. Inject `fetch` and generate keys locally.
- Read-only integration tests are allowed against testnet, and must skip when the RPC URL is
  absent.
- No test may sign or send a mainnet transaction.
- The legacy suite still uses the isolated Postgres/Redis setup described in
  `docs/OPERATIONS.md`. Never point tests at the application database.

## Known unknowns

1. NEAR RPC `query` finality behavior and rate limits under load.
2. Receipt/event schema for the venues we choose (Ref, Rhea, meme.cooking).
3. DexScreener/GeckoTerminal NEAR pool coverage.
4. NEP-413 signature encoding differences between wallets.
5. Privy NEAR support and the fallback auth path.
6. Testnet faucet limits for the demo account.
7. NearBlocks URL paths for token pages (verify `/token/<id>` before shipping links).
8. Real Wyntrax webhook delivery to the NEAR deployment, and whether the $WYNTRAX mint is
   legacy SPL Token or Token-2022. The fallback reads the classic token program and fails
   closed for Token-2022 rather than returning a false zero.
