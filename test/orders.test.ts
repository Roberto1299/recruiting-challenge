// Set DB_PATH before importing the db module — the connection is created on import.
if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

test('orders DAL: create + listByMerchant returns the order', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  const created = ordersDal.create({
    id: 'o1',
    merchant_id: 'm_test',
    customer_email: 'a@b.com',
    total_amount: 5000,
    type: 'sale',
    status: 'completed',
  });
  assert.equal(created.id, 'o1');
  const list = ordersDal.listByMerchant('m_test');
  assert.equal(list.length, 1);
  assert.equal(list[0]!.total_amount, 5000);
});

test('orders DAL: getById returns the order', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  ordersDal.create({
    id: 'o2',
    merchant_id: 'm_test',
    customer_email: 'c@d.com',
    total_amount: 1200,
    type: 'sale',
    status: 'completed',
  });
  const got = ordersDal.getById('o2', 'm_test');
  assert.equal(got?.total_amount, 1200);
});

test('orders DAL: getById does not leak orders across merchants', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_other', 'Other')`).run();
  ordersDal.create({
    id: 'o3',
    merchant_id: 'm_test',
    customer_email: 'e@f.com',
    total_amount: 999,
    type: 'sale',
    status: 'completed',
  });
  const got = ordersDal.getById('o3', 'm_other');
  assert.equal(got, undefined);
});

test('orders DAL: getById fails closed when merchantId is missing', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_test', 'Test')`).run();
  ordersDal.create({
    id: 'o4',
    merchant_id: 'm_test',
    customer_email: 'g@h.com',
    total_amount: 555,
    type: 'sale',
    status: 'completed',
  });
  assert.equal(ordersDal.getById('o4', undefined), undefined);
  assert.equal(ordersDal.getById('o4', ''), undefined);
});

test('orders DAL: iterateAllByMerchant returns every order, no cap, scoped by tenant', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_export', 'Test')`).run();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_export_other', 'Other')`).run();
  for (let i = 0; i < 150; i++) {
    ordersDal.create({
      id: `exp-${i}`,
      merchant_id: 'm_export',
      customer_email: 'e@f.com',
      total_amount: 100,
      type: 'sale',
      status: 'completed',
    });
  }
  ordersDal.create({ id: 'exp-other', merchant_id: 'm_export_other', customer_email: 'x@y.com', total_amount: 1, type: 'sale', status: 'completed' });

  const rows = [...ordersDal.iterateAllByMerchant('m_export')];
  assert.equal(rows.length, 150); // supera el cap de 100 que sí tiene listByMerchant
  assert.match(rows[0]!.created_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('orders DAL: iterateAllByMerchant applies the -6h CDMX shift to created_date', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_export_tz', 'Test')`).run();
  db.prepare(
    `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status, created_at)
     VALUES ('exp-tz1', 'm_export_tz', 'a@b.com', 100, 'sale', 'completed', '2026-08-30T04:00:00.000Z')`,
  ).run(); // 2026-08-29 22:00 CDMX

  const [row] = [...ordersDal.iterateAllByMerchant('m_export_tz')];
  assert.equal(row?.created_date, '2026-08-29');
});
