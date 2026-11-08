# Research access

Narrax uses local research access only. There is no on-chain token membership in this build.

## Tiers

`ACCESS_TIERS` in `packages/shared/src/entitlements.ts`:

- `NONE`
- `EARLY_ACCESS`
- `MEMBER`
- `PRO`

`MEMBER` and `PRO` are reserved levels; the admin UI currently grants
`EARLY_ACCESS` only. A database admin always receives every feature.

## Sign-in and grants

Sign-in is Privy email or Google. No browser wallet connection is requested or stored. Access is
resolved from `AccessGrant` rows and the admin decision. A grant can be created by:

- self-join through `POST /v1/me/early-access/join` while early access is open; or
- an admin through `POST /v1/admin/users/:userId/entitlements/grants`.

Admin lookup accepts a user id, Privy user id or verified email. Grants can be revoked and are
audited.

## Enforcement

`apps/api/src/entitlements/gating.ts` inventories feature-gated routes. The shared feature map
controls page limits and required tiers. UI locks are presentation only; every gated API request
checks access server-side. Realtime events and agent tools use the same decisions.

Account settings, alerts and admin routes remain available without a paid tier. Admin routes
still require the admin decision.
