/**
 * CSV field escaping (RFC 4180) plus a guard against formula/CSV injection:
 * spreadsheet apps (Excel, Sheets) treat a cell starting with =, +, -, or @
 * as a formula. customer_email is user-supplied input, so any field
 * starting with one of those gets a leading single quote — imported as
 * literal text, never executed.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@'];

export function escapeCsvField(value: string | number): string {
  let str = String(value);
  if (FORMULA_PREFIXES.some((p) => str.startsWith(p))) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsvRow(fields: Array<string | number>): string {
  return fields.map(escapeCsvField).join(',') + '\r\n';
}
