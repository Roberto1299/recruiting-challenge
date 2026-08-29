import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';
import { mexicoDayRangeToUtcBounds } from '../lib/dates.js';
import { toCsvRow } from '../lib/csv.js';
import { randomUUID } from 'node:crypto';

export const ordersRouter = Router();

ordersRouter.get('/', (req, res) => {
  const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
  const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
  let from: string | undefined;
  let to: string | undefined;
  if (fromRaw && toRaw) {
    try {
      ({ fromUtc: from, toUtc: to } = mexicoDayRangeToUtcBounds(fromRaw, toRaw));
    } catch {
      res.status(400).json({ error: 'invalid_date_range', detail: 'from and to must be YYYY-MM-DD' });
      return;
    }
  }
  const orders = ordersDal.listByMerchant(req.merchantId!, {
    from,
    to,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
  });
  res.json({ orders });
});

// Must come before GET /:id — otherwise Express would match "export" as an id param.
ordersRouter.get('/export', (req, res) => {
  const merchantId = req.merchantId!;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders_${merchantId}.csv"`);
  res.write(toCsvRow(['id', 'customer_email', 'total_amount', 'type', 'status', 'created_at']));
  for (const order of ordersDal.iterateAllByMerchant(merchantId)) {
    res.write(toCsvRow([order.id, order.customer_email, order.total_amount, order.type, order.status, order.created_date]));
  }
  res.end();
});

// Must come before GET /:id — same reason as /export.
ordersRouter.get('/search', (req, res) => {
  const merchantId = req.merchantId!;
  const q = req.query;

  const email = typeof q.email === 'string' ? q.email : undefined;
  const status = typeof q.status === 'string' ? q.status : undefined;
  const type = q.type === 'sale' || q.type === 'refund' ? q.type : undefined;

  const fromRaw = typeof q.from === 'string' ? q.from : undefined;
  const toRaw = typeof q.to === 'string' ? q.to : undefined;
  let from: string | undefined;
  let to: string | undefined;
  if (fromRaw && toRaw) {
    try {
      ({ fromUtc: from, toUtc: to } = mexicoDayRangeToUtcBounds(fromRaw, toRaw));
    } catch {
      res.status(400).json({ error: 'invalid_date_range', detail: 'from and to must be YYYY-MM-DD' });
      return;
    }
  }

  const limitRaw = typeof q.limit === 'string' ? Number(q.limit) : 20;
  const offset = typeof q.offset === 'string' ? Number(q.offset) : 0;
  if (!Number.isInteger(limitRaw) || !Number.isInteger(offset) || limitRaw < 1 || offset < 0) {
    res.status(400).json({ error: 'invalid_pagination', detail: 'limit must be >=1, offset must be >=0' });
    return;
  }
  const limit = Math.min(limitRaw, 100);

  const { orders, total } = ordersDal.search(merchantId, { email, status, type, from, to }, { limit, offset });

  res.json({ orders, total, limit, offset });
});

ordersRouter.get('/:id', (req, res) => {
  const order = ordersDal.getById(req.params.id, req.merchantId);
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ order });
});

ordersRouter.post('/', (req, res) => {
  const body = req.body as {
    customer_email?: string;
    total_amount?: number;
    type?: 'sale' | 'refund';
  };
  if (!body.customer_email || typeof body.total_amount !== 'number') {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const order = ordersDal.create({
    id: randomUUID(),
    merchant_id: req.merchantId!,
    customer_email: body.customer_email,
    total_amount: body.total_amount,
    type: body.type ?? 'sale',
    status: 'completed',
  });
  res.status(201).json({ order });
});
