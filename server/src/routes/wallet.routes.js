const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const {
  getWalletMe,
  createWalletTopupIntent,
  getWalletTopupStatus,
  listWalletLedger,
  listWalletPurchases,
  walletCheckout,
  processWalletWebhook,
} = require('../services/wallet.service');

const router = express.Router();

const topupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: { message: 'Ban da tao qua nhieu lenh nap quy. Vui long thu lai sau.' },
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: { message: 'Ban da thanh toan qua nhieu lan. Vui long thu lai sau.' },
});

router.post('/webhook/sepay', async (req, res) => {
  try {
    const result = await processWalletWebhook(req);
    return res.json({ webhookType: 'wallet', ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.use(protect);

router.get('/me', async (req, res) => {
  try {
    const data = await getWalletMe(req.user.id);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/ledger', async (req, res) => {
  try {
    const data = await listWalletLedger(req.user.id, {
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/topups', topupLimiter, async (req, res) => {
  try {
    const data = await createWalletTopupIntent(req.user.id, req.body?.amount, req.body?.bankKey);
    return res.status(201).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/topups/:id/status', async (req, res) => {
  try {
    const data = await getWalletTopupStatus(req.user.id, req.params.id);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/checkout', checkoutLimiter, async (req, res) => {
  try {
    const data = await walletCheckout(req.user.id, {
      productId: req.body?.productId,
      orderInput: {
        targetLink: req.body?.targetLink,
        quantity: req.body?.quantity,
        comments: req.body?.comments,
      },
    });
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/purchases', async (req, res) => {
  try {
    const data = await listWalletPurchases(req.user.id, {
      limit: req.query.limit,
      page: req.query.page,
    });
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
