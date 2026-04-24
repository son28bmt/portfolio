const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  getAccountMe,
  updateAccountMe,
  changeAccountPassword,
} = require('../services/account.service');

const router = express.Router();

router.use(protect);

router.get('/me', async (req, res) => {
  try {
    const account = await getAccountMe(req.user.id);
    return res.json(account);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/me', async (req, res) => {
  try {
    const account = await updateAccountMe(req.user.id, req.body || {});
    return res.json(account);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/password', async (req, res) => {
  try {
    const result = await changeAccountPassword(
      req.user.id,
      req.body?.currentPassword,
      req.body?.newPassword,
    );
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
