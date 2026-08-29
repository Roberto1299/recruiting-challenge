if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

function seedMerchant(id: string) {
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES (?, 'Test')`).run(id);
}

test('search: filters by email substring', () => {
  initSchema();
  seedMerchant('m_search_email');
  ordersDal.create({ id: 'se1', merchant_id: 'm_search_email', customer_email: 'carla@example.com', total_amount: 100, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'se2', merchant_id: 'm_search_email', customer_email: 'diego@example.com', total_amount: 100, type: 'sale', status: 'completed' });

  const { orders, total } = ordersDal.search('m_search_email', { email: 'carla' }, { limit: 20, offset: 0 });
  assert.equal(total, 1);
  assert.equal(orders[0]?.customer_email, 'carla@example.com');
});

test('search: escapes literal % and _ in the email filter', () => {
  initSchema();
  seedMerchant('m_search_escape');
  ordersDal.create({ id: 'sx1', merchant_id: 'm_search_escape', customer_email: '50%off@example.com', total_amount: 100, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'sx2', merchant_id: 'm_search_escape', customer_email: 'unrelated@example.com', total_amount: 100, type: 'sale', status: 'completed' });

  // Without escaping, "%" is a wildcard and "50%off" would match everything.
  const { orders, total } = ordersDal.search('m_search_escape', { email: '50%off' }, { limit: 20, offset: 0 });
  assert.equal(total, 1);
  assert.equal(orders[0]?.customer_email, '50%off@example.com');
});

test('search: filters by type', () => {
  initSchema();
  seedMerchant('m_search_type');
  ordersDal.create({ id: 'st1', merchant_id: 'm_search_type', customer_email: 'a@b.com', total_amount: 100, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'st2', merchant_id: 'm_search_type', customer_email: 'a@b.com', total_amount: 100, type: 'refund', status: 'completed' });

  const { orders, total } = ordersDal.search('m_search_type', { type: 'refund' }, { limit: 20, offset: 0 });
  assert.equal(total, 1);
  assert.equal(orders[0]?.type, 'refund');
});

test('search: filters by status', () => {
  initSchema();
  seedMerchant('m_search_status');
  ordersDal.create({ id: 'ss1', merchant_id: 'm_search_status', customer_email: 'a@b.com', total_amount: 100, type: 'sale', status: 'completed' });
  db.prepare(`INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status) VALUES ('ss2', 'm_search_status', 'a@b.com', 100, 'sale', 'pending')`).run();

  const { orders, total } = ordersDal.search('m_search_status', { status: 'pending' }, { limit: 20, offset: 0 });
  assert.equal(total, 1);
  assert.equal(orders[0]?.status, 'pending');
});

test('search: filters by date range (reuses the CDMX-aware bounds)', () => {
  initSchema();
  seedMerchant('m_search_date');
  db.prepare(
    `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES ('sd1', 'm_search_date', 'a@b.com', 100, 'sale', 'completed', '2026-08-15T12:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES ('sd2', 'm_search_date', 'a@b.com', 100, 'sale', 'completed', '2026-08-01T12:00:00.000Z')`,
  ).run();

  const { total } = ordersDal.search(
    'm_search_date',
    { from: '2026-08-10T06:00:00.000Z', to: '2026-08-20T06:00:00.000Z' },
    { limit: 20, offset: 0 },
  );
  assert.equal(total, 1);
});

test('search: combines multiple filters (AND, not OR)', () => {
  initSchema();
  seedMerchant('m_search_combo');
  ordersDal.create({ id: 'sc1', merchant_id: 'm_search_combo', customer_email: 'carla@example.com', total_amount: 100, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'sc2', merchant_id: 'm_search_combo', customer_email: 'carla@example.com', total_amount: 100, type: 'refund', status: 'completed' });

  const { total } = ordersDal.search('m_search_combo', { email: 'carla', type: 'sale' }, { limit: 20, offset: 0 });
  assert.equal(total, 1);
});

test('search: pagination — total reflects all matches, orders respects limit/offset', () => {
  initSchema();
  seedMerchant('m_search_page');
  for (let i = 0; i < 25; i++) {
    ordersDal.create({ id: `sp${i}`, merchant_id: 'm_search_page', customer_email: 'a@b.com', total_amount: 100, type: 'sale', status: 'completed' });
  }

  const page1 = ordersDal.search('m_search_page', {}, { limit: 20, offset: 0 });
  assert.equal(page1.total, 25);
  assert.equal(page1.orders.length, 20);

  const page2 = ordersDal.search('m_search_page', {}, { limit: 20, offset: 20 });
  assert.equal(page2.total, 25);
  assert.equal(page2.orders.length, 5);
});

test('search: scoped to merchant — no cross-tenant leak', () => {
  initSchema();
  seedMerchant('m_search_tenant');
  seedMerchant('m_search_tenant_other');
  ordersDal.create({ id: 'st_a', merchant_id: 'm_search_tenant', customer_email: 'a@b.com', total_amount: 100, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'st_b', merchant_id: 'm_search_tenant_other', customer_email: 'a@b.com', total_amount: 100, type: 'sale', status: 'completed' });

  const { total } = ordersDal.search('m_search_tenant', {}, { limit: 20, offset: 0 });
  assert.equal(total, 1);
});
