# Demo seed

`seed.json` is a small read-only research snapshot exported from a NARRAX mainnet run. It populates
the public judge demo without waiting for the pipeline to collect data.

## What is included

- narratives and narrative metrics
- named, non-bridged research tokens with their latest price, holder and risk rows
- narrative-token relations
- opportunities and global alerts

No users, access grants, chats, notifications, private research, smart-money rows, transaction
hashes, system settings, keys or provider credentials are included.

Smart-money evidence and full metric history are intentionally omitted from the public seed. Run the
workers against a demo database if you want to populate those surfaces.

## Refresh

Maintainers can rebuild it from a populated database:

```bash
npm run demo:export
```

## Load

Point `DATABASE_URL` at a **demo database**, apply migrations, then:

```bash
DEMO_SEED_CONFIRM=yes npm run demo:seed
```

The seed replaces the research rows in the target database. Do not run it against production.

The snapshot is dated. Its timestamps and the generated `THESIS_EVIDENCE.md` should be refreshed
after a longer collection window if the evidence is being reviewed later.
