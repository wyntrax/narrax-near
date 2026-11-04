# NARRAX — agent guide

## What this repository is

The **NEAR deployment** of the NARRAX research desk (`narrax-near`). The product shell is
shared with the original build; the chain layer is being ported from Solana to NEAR. The
commercial repository stays private.

## Stack

- Node 22, TypeScript, npm workspaces
- `apps/web`: Next.js 15, React 19, next-intl (EN/ID)
- `apps/api`: HTTP API, auth, entitlements, admin, paper trades
- `workers/pipeline`: narratives, discovery, scoring, market data
- `workers/executor`: dry-run order path
- `packages/near`: NEAR RPC, NEP-141, NEP-413, explorer, config
- `packages/shared`: chain routing, entitlements, brand, env checks
- Postgres (Prisma) + Redis

## Commands

```bash
npm install
npm run typecheck             # root + web
npm test                      # backend + packages (isolated DB/Redis required for integration)
npm test -w @narra/web        # web unit tests
npm run dev:api               # API :4000
npm run dev:web               # web :4010
npm run dev:workers           # pipeline
```

Focused NEAR and access tests (no DB, no network):

```bash
npx vitest run packages/near packages/shared/src/chains.test.ts \
  packages/shared/src/entitlements.test.ts apps/api/src/entitlements/holdings.test.ts
```

## Rules

1. **Testnet only.** Default network is testnet. Never add mainnet signing, spending, or
   deployment. Mainnet requires explicit owner approval and a separate security review.
2. **No signing keys in the executor.** It stays dry-run unless the Phase 4 design is approved.
3. **Paper-first.** Manual portfolio controls are paper-only. Do not wire live trading into
   them.
4. **Server-side authorization.** UI locks are presentation. Every gated route checks access
   on the server; URL manipulation must not bypass it.
5. **No custom contracts** (owner decision). Entitlements use the signed Wyntrax membership
   webhook (primary) or a read-only SPL holding fallback. The $WYNTRAX Solana token is the
   source of truth; no private Solana API calls, no shared database.
6. **No secrets in git.** `.env` is ignored. Never log keys or full signed payloads.
7. **Tests never touch the application DB or Redis.** Use the isolated test database and test
   Redis; integration tests skip rather than run against real services.
8. **No fabricated data.** If a price, holder count, or trade is unknown, show unknown. Do not
   invent chain evidence.
9. **Preserve the product shell.** UI mostly stays the same; change copy and data sources, not
   the interaction model, unless asked.
10. **No pushes or public releases** without explicit human confirmation.

## Where things live

| Need | File |
| --- | --- |
| NEAR RPC client | `packages/near/src/rpc.ts` |
| NEP-141 metadata/balance | `packages/near/src/nep141.ts` |
| NEP-413 sign/verify | `packages/near/src/nep413.ts` |
| Account validation | `packages/near/src/account.ts` |
| Explorer links | `packages/near/src/explorer.ts` |
| Chain status API | `apps/api/src/chain.ts` |
| $WYNTRAX direct holding fallback | `apps/api/src/entitlements/holdings.ts` |
| Entitlement resolution | `packages/shared/src/entitlements.ts` |
| Access trace / feature gates | `apps/api/src/entitlements/access.ts` |
| Network config | `packages/near/src/config.ts` |
| Host → chain routing | `packages/shared/src/chains.ts` |
| Porting plan | `docs/PORTING.md` |
| Current state | `docs/CONTINUATION.md` |

## Verification expectations

- Run `npm run typecheck` and the focused tests for anything you change.
- If a suite cannot run, say so and why. Do not claim a pass you did not observe.
- Report unverified behavior (live RPC, real wallet, production build) explicitly.
