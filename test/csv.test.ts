import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvField, toCsvRow } from '../src/lib/csv.js';

test('csv: plain fields pass through unchanged', () => {
  assert.equal(escapeCsvField('sale'), 'sale');
  assert.equal(escapeCsvField(1234), '1234');
});

test('csv: quotes fields containing a comma', () => {
  assert.equal(escapeCsvField('a,b'), '"a,b"');
});

test('csv: quotes and doubles internal quotes', () => {
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
});

test('csv: quotes fields containing a newline', () => {
  assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"');
});

test('csv: guards against formula injection', () => {
  assert.equal(escapeCsvField('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsvField('+1'), "'+1");
  assert.equal(escapeCsvField('-1'), "'-1");
  assert.equal(escapeCsvField('@cmd'), "'@cmd");
});

test('csv: toCsvRow joins fields with commas and CRLF', () => {
  assert.equal(toCsvRow(['a', 'b', 1]), 'a,b,1\r\n');
});
