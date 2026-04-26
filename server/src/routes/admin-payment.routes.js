const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const {
  getEffectivePaymentAccounts,
  savePaymentAccounts,
} = require('../services/donate.service');

const router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get('/bank-accounts', async (req, res) => {
  try {
    const items = await getEffectivePaymentAccounts();
    return res.json({ items });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/bank-accounts', async (req, res) => {
  try {
    const items = await savePaymentAccounts(req.body?.items || []);
    return res.json({ items });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
