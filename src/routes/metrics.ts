import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';

export const metricsRouter = Router();

/**
 * GET /api/metrics/summary
 *
 * Returns dashboard summary stats for the current merchant.
 */
metricsRouter.get('/summary', (req, res) => {
  const merchantId = req.merchantId!;
  const summary = ordersDal.summaryByMerchant(merchantId);
  res.json({ merchant_id: merchantId, ...summary });
});

metricsRouter.get('/top-customers', (req, res) => {
  const merchantId = req.merchantId!;
  const limit = Number(req.query.limit ?? 5);
  const customers = ordersDal.topCustomers(merchantId, limit);
  res.json({ customers });
});
