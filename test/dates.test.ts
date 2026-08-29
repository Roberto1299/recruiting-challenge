import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mexicoDayRangeToUtcBounds } from '../src/lib/dates.js';

test('dates: converts a single CDMX day to UTC bounds (UTC-6, no DST since 2022)', () => {
  const { fromUtc, toUtc } = mexicoDayRangeToUtcBounds('2026-08-28', '2026-08-28');
  assert.equal(fromUtc, '2026-08-28T06:00:00.000Z'); // 2026-08-28 00:00 CDMX
  assert.equal(toUtc, '2026-08-29T06:00:00.000Z'); // 2026-08-29 00:00 CDMX (exclusive)
});

test('dates: an order at 23:59:59 CDMX on the "to" day is included', () => {
  const { fromUtc, toUtc } = mexicoDayRangeToUtcBounds('2026-08-01', '2026-08-28');
  const orderUtc = '2026-08-29T05:59:59.000Z'; // 2026-08-28 23:59:59 CDMX
  assert.ok(orderUtc >= fromUtc && orderUtc < toUtc);
});

test('dates: next day\'s midnight CDMX is excluded (exclusive upper bound)', () => {
  const { toUtc } = mexicoDayRangeToUtcBounds('2026-08-01', '2026-08-28');
  const nextMidnightUtc = '2026-08-29T06:00:00.000Z'; // 2026-08-29 00:00 CDMX
  assert.equal(nextMidnightUtc < toUtc, false);
});

test('dates: throws on malformed date input', () => {
  assert.throws(() => mexicoDayRangeToUtcBounds('not-a-date', '2026-08-28'));
});
