# Narrax web

Next.js 15 research workspace for the NEAR-only Narrax build. Sign-in is Privy email or Google.
No browser wallet connection, wallet linking, portfolio or paper-trading UI is included.

## Local development

```bash
# from the repository root
npm install
npm run dev:web     # http://localhost:4010
```

Public values are read from the inherited process environment. The Next scripts disable
automatic env-file loading. Required values:

| Variable | Local value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | your public Privy app id |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:4010` |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` |
| API `CORS_ORIGINS` | `http://localhost:4010` |

## Checks

```bash
npm run typecheck -w @narra/web
npm test -w @narra/web
npm run build -w @narra/web
```

The production build rejects the Playwright fixture-auth flag. Browser tests are optional; start
the API and web locally before running them.
