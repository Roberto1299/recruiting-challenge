import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH ?? 'data/dashboard.db';

if (!existsSync(dirname(DB_PATH))) {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      customer_email TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'sale',
      status TEXT NOT NULL DEFAULT 'completed',
      -- ISO 8601 with 'T'/'Z' and milliseconds, matching JS toISOString().
      -- NOTE: CREATE TABLE IF NOT EXISTS won't retrofit this default onto an
      -- already-existing orders table (or reformat rows already stored under
      -- the old CURRENT_TIMESTAMP format) — a real deployment needs a table
      -- rebuild + backfill migration, not just this code change.
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  `);
}
