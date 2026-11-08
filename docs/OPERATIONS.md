# Operations

## Local services

- Postgres 16+
- Redis 7+ with Redis Streams. Redis 3.x/Windows ports do not support `XREAD`; use Memurai,
  WSL Redis or Docker Redis.
- NEAR RPC: testnet by default (`https://rpc.testnet.near.org`).

## Start

```bash
npm install
npx prisma generate --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npm run dev:api
npm run dev:web
npm run dev:workers
```

Optional focused workers:

```bash
npm run dev:narratives
npm run dev:market
npm run dev:personal-research
```

## Health

- `GET /health` — process liveness
- `GET /v1/chain` — active network and explorer
- `GET /v1/chain/status` — latest final block and latency
- Admin → Research health — market coverage, queues, AI budget and alerts

## Redis realtime

`REALTIME_STREAM_KEY` defaults to `narrax:events`. The API uses two Redis connections: one for
range reads and one for the blocking `XREAD`. The gateway can replay a bounded window and tells a
client to refetch when the window is exceeded.

## Access expiry

Run `npm run entitlements:expire` from cron or Task Scheduler to mark expired local grants. Access
checks also enforce expiry at read time, so a missed sweep cannot extend access.
