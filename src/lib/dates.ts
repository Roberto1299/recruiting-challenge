/**
 * Business-timezone date handling.
 *
 * There's no per-merchant timezone in the data model and no business rule
 * documented for it — this codebase has decided America/Mexico_City as the
 * single business timezone until that changes. Mexico abolished daylight
 * saving time nationwide by decree in 2022 (border-strip municipalities
 * excepted, not relevant here), so Mexico City sits at a fixed UTC-6 offset
 * — no DST math needed. If that ever changes, or per-merchant timezones are
 * needed, this constant/function is the one place to revisit.
 */
const BUSINESS_UTC_OFFSET = '-06:00';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a `from`/`to` calendar-day range (YYYY-MM-DD, inclusive on both
 * ends from the caller's point of view) into UTC-ISO bounds ready to compare
 * against `created_at`: `fromUtc <= created_at < toUtc`.
 *
 * Days are calendar days in the business timezone, not UTC — an order at
 * 23:59:59 local time on `to` is included; the exclusive upper bound is the
 * next local midnight, converted to UTC.
 */
export function mexicoDayRangeToUtcBounds(from: string, to: string): { fromUtc: string; toUtc: string } {
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
    throw new Error(`invalid date range: ${from} .. ${to} (expected YYYY-MM-DD)`);
  }
  // toISOString() throws RangeError on an out-of-range calendar date (e.g.
  // month 13) even though the regex above already caught the wrong shape —
  // callers already treat any thrown error here as "invalid_date_range".
  const fromUtc = new Date(`${from}T00:00:00${BUSINESS_UTC_OFFSET}`).toISOString();
  const toDate = new Date(`${to}T00:00:00${BUSINESS_UTC_OFFSET}`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  return { fromUtc, toUtc: toDate.toISOString() };
}
