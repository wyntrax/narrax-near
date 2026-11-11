# Demo seed

`seed.json` is a read-only research snapshot exported from a NARRAX mainnet run. It populates the
public judge demo without waiting for the pipeline to collect data.

## What is included

- narratives and narrative metrics
- tokens, price metrics, holder metrics and risk rows
- narrative-token relations
- opportunities and global alerts
- observed smart-money wallets and profiles
- market evidence settings

No users, access grants, chats, notifications, private research, keys or provider credentials are
included. Smart-money trade rows are omitted from the public seed; run the workers to collect trade
evidence.

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
