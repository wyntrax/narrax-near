# Judge guide

The fastest way to test NARRAX is the **public path**. It needs only Node 22 and Postgres 16. It
does not need Privy, a wallet, Redis or an AI key.

The authenticated workspace (`/app/...`) is shown in the demo video and requires a Privy app; it is
not part of the public judge path.

## Public path — 5 minutes

From the repository root:

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
DEMO_SEED_CONFIRM=yes npm run demo:seed
npm run dev:api:public
```

`demo:seed` loads a real read-only research snapshot. It removes and replaces the research tables in
the target database, so point `DATABASE_URL` at a demo database, not production.

In a second terminal:

```bash
export NEXT_PUBLIC_API_URL=http://localhost:4000
export NEXT_PUBLIC_SITE_URL=http://localhost:4010
npm run dev:web
```

PowerShell equivalents:

```powershell
$env:NEXT_PUBLIC_API_URL='http://localhost:4000'
$env:NEXT_PUBLIC_SITE_URL='http://localhost:4010'
npm run dev:web
```

Seed step on PowerShell:

```powershell
Copy-Item .env.example .env
$env:DEMO_SEED_CONFIRM='yes'
npm run demo:seed
```

No Docker? Use a local Postgres 16 and set `DATABASE_URL` in `.env`. The default
`postgresql://narra:narra@localhost:5432/narra` matches the included compose service.

## Do X → see Y

| Do this | See this |
| --- | --- |
| Open `http://localhost:4010/` | The landing page and the public research snapshot counts from the seeded DB. |
| Open `http://localhost:4010/agent-risk` and click **Use example** | `PASS` for `nearly-993927.nearlytrade.near`: 2,680 holders, 19.1% top-10 concentration, fresh evidence. |
| Enter an unknown account id and submit | `UNKNOWN`, explicitly treated as blocked by the agent policy. |
| Open `http://localhost:4000/health` | `{"status":"ok","brand":"NARRAX"}`. |
| Open `http://localhost:4000/v1/public-research-snapshot` | Aggregate research counts. |
| Open `http://localhost:4000/v1/agent/risk/nearly-993927.nearlytrade.near` | The raw `PASS` verdict JSON. |
| Read `THESIS_EVIDENCE.md` and `THESIS_EVIDENCE.svg` | The generated thesis evidence and chart. |
| Read `docs/AGENT_RISK.md` | The public risk-gate contract, policy example and security model. |
| Read `docs/DEMO.md` | The video walkthrough and X post draft. |
| Browse `docs/screenshots/` | Real screenshots of the landing page and both risk verdicts. |

## Full workspace — requires Privy

The authenticated research workspace is not part of the public path. To run it:

1. Set `PRIVY_APP_ID`, `PRIVY_APP_SECRET` and `PRIVY_VERIFICATION_KEY` in `.env`.
2. Keep `DATABASE_URL` and `REDIS_URL` pointed at the demo services.
3. Run `npm run dev:api` and `npm run dev:workers`.
4. Sign in with a Privy email/Google account and grant that account early access from the admin UI.

The workspace is read-only: no wallet connection, no signing, no orders, no custody.

## Reproducibility checks

```bash
npm run typecheck
npm run build -w @narra/web
```

The unit/package tests run with `npm test`. Integration tests that need Postgres and Redis are
skipped unless `NARRA_TEST_DATABASE_NAME`, `DATABASE_URL` and `NARRA_TEST_REDIS_URL` point at
isolated test services; see the README's Test section.

## What this project is judged on

| Track | Where to look |
| --- | --- |
| `thesis` | `THESIS.md`, `THESIS_EVIDENCE.md`, `scripts/thesis-report.ts`, the research workspace. |
| `security` | `docs/AGENT_RISK.md`, `apps/api/src/agentRisk.ts`, `/agent-risk`, the public risk JSON. |
| `open` | The public research workspace, methodology pages and the reproducible pipeline. |

## Honest limits

- Research only. There is no signing, order, custody or portfolio path.
- Market evidence is mainnet-only; there is no testnet DEX feed.
- The demo seed is a dated snapshot, not a live feed. Its timestamps stay visible.
- A `PASS` verdict means the latest observation did not cross the critical risk policy. It is not a
  safety guarantee.
- Missing data stays `UNKNOWN`; it is never replaced with zero.
