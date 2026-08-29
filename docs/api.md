# API reference

> Quick-and-dirty. Not complete.

All endpoints require the `X-Merchant-Id` header.

## `GET /api/health`
No auth. Returns `{ ok: true }`.

## `GET /api/orders`
List orders for the authenticated merchant. Optional query: `from`, `to`, `limit`.
`from`/`to` are `YYYY-MM-DD` calendar days in the business timezone (see
"Date ranges" below) — must be passed together, or both are ignored.

## `GET /api/orders/export`
CSV export of every order for the authenticated merchant — no date filter,
no row cap. Columns: `id, customer_email, total_amount, type, status,
created_at`. `created_at` is `YYYY-MM-DD`, shifted to the business timezone
(America/Mexico_City, fixed -6h) at the SQL level — see
`ordersDal.iterateAllByMerchant`. `total_amount` is raw cents, as stored.
`Content-Type: text/csv`, downloads as `orders_{merchant_id}.csv`.

## `GET /api/orders/:id`
Get a single order by ID, scoped to the authenticated merchant.
Returns `404` both if the order doesn't exist and if it belongs to a
different merchant (no existence leak across tenants).

## `POST /api/orders`
Body: `{ customer_email, total_amount, type? }`.

## `GET /api/revenue?from=...&to=...`
Total revenue for the merchant in the date range. `from` and `to` are
required `YYYY-MM-DD` calendar days (see "Date ranges" below). Returns `400`
if either is missing or not a valid calendar date.

## `GET /api/metrics/summary`
TODO: document fields.

## `GET /api/metrics/top-customers`
TODO: document fields.

## Date ranges

`from`/`to` query params are calendar days (`YYYY-MM-DD`), interpreted in
**America/Mexico_City**, not UTC and not the caller's local timezone. There's
no per-merchant timezone in the data model and no business rule for one yet
— Mexico City was picked as a fixed default (see `src/lib/dates.ts`). A day
runs from local midnight (inclusive) to the next local midnight (exclusive),
so an order at 23:59:59 local time on `to` is included in the range.

Mexico abolished DST nationwide by decree in 2022 (border-strip
municipalities excepted), so this is implemented as a fixed UTC-6 offset,
not a timezone-aware calculation. If DST rules change, or per-merchant
timezones are needed, `src/lib/dates.ts` is the one place to revisit.
