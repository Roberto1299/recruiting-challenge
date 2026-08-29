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
