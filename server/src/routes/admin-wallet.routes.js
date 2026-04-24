const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const {
  getAdminWalletUsers,
  getAdminWalletTopups,
  getAdminWalletLedger,
} = require('../services/wallet.service');

const router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get('/users', async (req, res) => {
  try {
    const data = await getAdminWalletUsers(req.query || {});
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/topups', async (req, res) => {
  try {
    const data = await getAdminWalletTopups(req.query || {});
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/ledger', async (req, res) => {
  try {
    const data = await getAdminWalletLedger(req.query || {});
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
