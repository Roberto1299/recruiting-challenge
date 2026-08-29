import { db } from '../db.js';

export interface OrderRow {
  id: string;
  merchant_id: string;
  customer_email: string;
  total_amount: number;
  type: 'sale' | 'refund';
  status: string;
  created_at: string;
}

/**
 * Data-access layer for orders. All order queries should go through here.
 *
 * - centralized place for query patterns
 * - the place to add auditing, caching, tenancy filters
 * - the seam for swapping the underlying store
 */
export const ordersDal = {
  listByMerchant(merchantId: string, opts: { from?: string; to?: string; limit?: number } = {}): OrderRow[] {
    const limit = opts.limit ?? 100;
    if (opts.from && opts.to) {
      return db
        .prepare(
          `SELECT * FROM orders
           WHERE merchant_id = ? AND created_at >= ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(merchantId, opts.from, opts.to, limit) as OrderRow[];
    }
    return db
      .prepare(`SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(merchantId, limit) as OrderRow[];
  },

  /**
   * Fetches an order by id, scoped to the requesting merchant.
   * Returns undefined both when the order doesn't exist and when it
   * belongs to a different merchant — callers can't tell the two apart,
   * which is intentional (no existence leak). Also returns undefined
   * (fail closed) if merchantId is missing, instead of querying with it.
   */
  getById(id: string, merchantId: string | undefined): OrderRow | undefined {
    if (!merchantId) return undefined;
    return db
      .prepare(`SELECT * FROM orders WHERE id = ? AND merchant_id = ?`)
      .get(id, merchantId) as OrderRow | undefined;
  },

  create(order: Omit<OrderRow, 'created_at'>): OrderRow {
    db.prepare(
      `INSERT INTO orders (id, merchant_id, customer_email, total_amount, type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(order.id, order.merchant_id, order.customer_email, order.total_amount, order.type, order.status);
    return this.getById(order.id, order.merchant_id)!;
  },

  /**
   * Sum total_amount over a date range for a merchant.
   * Used by the revenue endpoint.
   */
  sumAmountByMerchant(merchantId: string, from: string, to: string): number {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders
         WHERE merchant_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(merchantId, from, to) as { total: number };
    return row.total;
  },

  /**
   * Summary stats for a merchant's orders. Used by the metrics endpoint.
   */
  summaryByMerchant(merchantId: string): {
    total_orders: number;
    unique_customers: number;
    avg_order_value_cents: number;
  } {
    const totalOrdersRow = db
      .prepare(`SELECT COUNT(*) AS n FROM orders WHERE merchant_id = ?`)
      .get(merchantId) as { n: number };

    const totalCustomersRow = db
      .prepare(`SELECT COUNT(DISTINCT customer_email) AS n FROM orders WHERE merchant_id = ?`)
      .get(merchantId) as { n: number };

    const avgOrderRow = db
      .prepare(`SELECT COALESCE(AVG(total_amount), 0) AS avg FROM orders WHERE merchant_id = ?`)
      .get(merchantId) as { avg: number };

    return {
      total_orders: totalOrdersRow.n,
      unique_customers: totalCustomersRow.n,
      avg_order_value_cents: Math.round(avgOrderRow.avg),
    };
  },

  /**
   * Top customers by total spend for a merchant. Used by the metrics endpoint.
   */
  topCustomers(
    merchantId: string,
    limit: number,
  ): Array<{ customer_email: string; order_count: number; total_spent: number }> {
    return db
      .prepare(
        `SELECT customer_email, COUNT(*) AS order_count, SUM(total_amount) AS total_spent
         FROM orders
         WHERE merchant_id = ?
         GROUP BY customer_email
         ORDER BY total_spent DESC
         LIMIT ?`,
      )
      .all(merchantId, limit) as Array<{ customer_email: string; order_count: number; total_spent: number }>;
  },

  /**
   * Iterates every order for a merchant, for the CSV export report — no
   * date filter, no row cap (unlike listByMerchant, which is capped for
   * the dashboard's "recent orders" table). Streams via better-sqlite3's
   * .iterate() instead of .all() so a large order history isn't buffered
   * into memory at once.
   *
   * created_date shifts created_at by -6 hours before taking the date part
   * — same fixed America/Mexico_City offset as BUSINESS_UTC_OFFSET in
   * lib/dates.ts (Mexico has had no DST since a 2022 decree). Kept as a
   * literal SQL offset here instead of importing dates.ts — if that offset
   * ever changes, this query needs updating too.
   */
  iterateAllByMerchant(merchantId: string): IterableIterator<{
    id: string;
    customer_email: string;
    total_amount: number;
    type: 'sale' | 'refund';
    status: string;
    created_date: string;
  }> {
    return db
      .prepare(
        `SELECT id, customer_email, total_amount, type, status,
                strftime('%Y-%m-%d', created_at, '-6 hours') AS created_date
         FROM orders
         WHERE merchant_id = ?
         ORDER BY created_at DESC`,
      )
      .iterate(merchantId) as IterableIterator<{
      id: string;
      customer_email: string;
      total_amount: number;
      type: 'sale' | 'refund';
      status: string;
      created_date: string;
    }>;
  },
};
