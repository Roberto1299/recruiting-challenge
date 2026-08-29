if (!process.env.DB_PATH) process.env.DB_PATH = ':memory:';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initSchema, db } from '../src/db.js';
import { ordersDal } from '../src/dal/orders-dal.js';

test('metrics: summaryByMerchant is scoped to the given merchant', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_summary', 'Test')`).run();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_summary_other', 'Other')`).run();
  ordersDal.create({ id: 'ms1', merchant_id: 'm_summary', customer_email: 'a@b.com', total_amount: 1000, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'ms2', merchant_id: 'm_summary', customer_email: 'a@b.com', total_amount: 2000, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'ms3', merchant_id: 'm_summary_other', customer_email: 'x@y.com', total_amount: 999999, type: 'sale', status: 'completed' });

  const summary = ordersDal.summaryByMerchant('m_summary');
  assert.equal(summary.total_orders, 2);
  assert.equal(summary.unique_customers, 1);
  assert.equal(summary.avg_order_value_cents, 1500);
});

test('metrics: topCustomers ranks by total spend, scoped to merchant', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_top', 'Test')`).run();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_top_other', 'Other')`).run();
  ordersDal.create({ id: 'mt1', merchant_id: 'm_top', customer_email: 'low@b.com', total_amount: 500, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'mt2', merchant_id: 'm_top', customer_email: 'high@b.com', total_amount: 5000, type: 'sale', status: 'completed' });
  ordersDal.create({ id: 'mt3', merchant_id: 'm_top_other', customer_email: 'noise@b.com', total_amount: 999999, type: 'sale', status: 'completed' });

  const top = ordersDal.topCustomers('m_top', 5);
  assert.equal(top.length, 2);
  assert.equal(top[0]?.customer_email, 'high@b.com');
  assert.equal(top[0]?.total_spent, 5000);
});

test('metrics: a merchant with zero orders gets zeroed stats, not a crash or null', () => {
  initSchema();
  db.prepare(`INSERT OR IGNORE INTO merchants (id, name) VALUES ('m_empty', 'No orders yet')`).run();

  const summary = ordersDal.summaryByMerchant('m_empty');
  assert.deepEqual(summary, { total_orders: 0, unique_customers: 0, avg_order_value_cents: 0 });

  const top = ordersDal.topCustomers('m_empty', 5);
  assert.deepEqual(top, []);
});
