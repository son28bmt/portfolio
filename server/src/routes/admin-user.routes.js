const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const {
  listAdminUsers,
  getAdminUserDetail,
  updateAdminUserProfile,
  updateAdminUserWalletStatus,
  resetAdminUserPassword,
} = require('../services/admin-user.service');

const router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const data = await listAdminUsers(req.query || {});
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getAdminUserDetail(req.params.id);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/:id/profile', async (req, res) => {
  try {
    const data = await updateAdminUserProfile(req.params.id, req.body || {});
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.patch('/:id/wallet-status', async (req, res) => {
  try {
    const data = await updateAdminUserWalletStatus(req.params.id, req.body?.status);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:id/password', async (req, res) => {
  try {
    const data = await resetAdminUserPassword(req.params.id, req.body?.password);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
