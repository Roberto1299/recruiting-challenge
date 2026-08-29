# Architecture (DRAFT — needs love)

> This file was started a while ago and hasn't been kept up to date.
> Treat as partial. Update what you change.

## Modules

- **`server.ts`** — Express bootstrapper. Wires routers to paths.
- **`db.ts`** — SQLite connection + schema init. Single shared `db` instance.
- **`auth.ts`** — request authentication. Today: trusts `X-Merchant-Id` header.
  Eventually this becomes a real signed token; the header shape is a placeholder.
- **`dal/`** — data-access layer. The intent is that all order queries route
  through `ordersDal` so we have one place to add auditing, caching, tenancy
  filters, etc. All routes now go through it, including `metrics.ts`.
- **`routes/`** — Express routers, one file per resource.
- **`lib/`** — utilities. Currently `dates.ts`: converts `from`/`to` calendar
  days into UTC bounds for `created_at` comparisons, anchored to a fixed
  business timezone (`America/Mexico_City`, UTC-6, no DST). See
  `docs/api.md` → "Date ranges" for the reasoning.

## Data model

Two tables: `merchants`, `orders`. See `db.ts` for the canonical DDL.

`orders.type` is one of `'sale' | 'refund'`. A refund row records that a sale
was reversed; it does not by itself reverse the sale row.

`orders.created_at` defaults to `strftime('%Y-%m-%dT%H:%M:%fZ','now')` —
ISO 8601 with `T`/`Z`, matching `Date.prototype.toISOString()` — so it can be
compared as a string against the ISO bounds `lib/dates.ts` produces. This
default only applies to tables created fresh by `CREATE TABLE IF NOT EXISTS`;
an already-existing production `orders` table would keep its old
`CURRENT_TIMESTAMP` default (different format: space-separated, no
milliseconds, no `Z`) until a table-rebuild + backfill migration runs. No
such migration exists yet — this repo has only ever run against dev DBs
created from scratch.

## Open items

- ~~Wire `dashboard.tsx` once we pick a frontend framework~~ — went with static HTML+fetch instead. Doc stale.
- Decide whether `analytics-events` is its own service or a route here.
- Audit logging — TBD where it lives.
- Migration + backfill for `orders.created_at` format, needed before this
  runs against any pre-existing (non-fresh) database. See "Data model" above.
- Per-merchant timezone — `lib/dates.ts` hardcodes `America/Mexico_City`.
