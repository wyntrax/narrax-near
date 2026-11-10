# NARRAX — agent guide

## What this repository is

The **NEAR-only** NARRAX research desk (`narrax-near`). Legacy chain adapters and trading,
custody, portfolio and executor code have been removed. The commercial repository stays private.

## Stack

- Node 22, TypeScript, npm workspaces
- `apps/web`: Next.js 15, React 19, next-intl (EN/ID)
- `apps/api`: HTTP API, Privy auth, local access grants, admin, research chat
- `workers/pipeline`: narratives, tokens, market data, outcomes, alerts, Telegram
- `packages/near`: NEAR RPC, NEP-141, NEP-413, explorer, config
- `packages/shared`: chain routing, access policy, brand, env checks
- Postgres (Prisma) + Redis 7+

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

## Rules

1. **NEAR only.** Do not add legacy chain packages, RPCs, mints, explorers, wallet adapters or token
   gates. NEAR token identity is an account id, not a base58 mint.
2. **Research only.** There is no signing, order, position, portfolio, paper-trading or executor
   path. Do not reintroduce one without an explicit owner decision and a security review.
3. **Testnet by default.** Mainnet requires explicit owner approval and a separate review.
4. **Server-side authorization.** UI locks are presentation. Every gated route checks access on
   the server; URL manipulation must not bypass it.
5. **Local access only.** No token-holding membership. Admin grants and optional self-join early
   access are the source of truth.
6. **No secrets in git.** `.env` is ignored. Never log keys or full signed payloads.
7. **Tests never touch the application DB or Redis.** Use the isolated test database and test
   Redis; integration tests skip rather than run against real services.
8. **No fabricated data.** If a price, holder count or outcome is unknown, show unknown. Missing
   data is never zero.
9. **Untrusted text stays untrusted.** Social/token text is sanitized before storage and rendered
   as plain text; model tools receive it under the `untrusted` field.
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
| Agent risk gate | `apps/api/src/agentRisk.ts` |
| Agent risk contract | `docs/AGENT_RISK.md` |
| Holder fallback | `packages/market-data/src/nearblocks.ts` |
| Thesis report | `scripts/thesis-report.ts` |
| Access resolution | `packages/shared/src/entitlements.ts` |
| Access trace / feature gates | `apps/api/src/entitlements/access.ts` |
| Network config | `packages/near/src/config.ts` |
| Research pipeline | `workers/pipeline/src/main.ts` |
| Provider schemas | Docs under `docs/` |
