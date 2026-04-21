const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { LiveChatMessage } = require('../models');
const { protect } = require('../middleware/auth.middleware');

const optionalProtect = async (req, res, next) => {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return next();
  return protect(req, res, next);
};

const isValidGuestToken = (token, guestId) => {
  if (!token || !guestId) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    return (
      decoded?.scope === 'guest_chat' &&
      String(decoded?.guestId || '') === String(guestId)
    );
  } catch {
    return false;
  }
};

router.get('/history/:guestId', optionalProtect, async (req, res) => {
  try {
    const { guestId } = req.params;
    const isAdminRequest = Boolean(req.user);

    if (!isAdminRequest) {
      const guestToken = String(
        req.headers['x-guest-token'] || req.query.guest_token || ''
      ).trim();

      if (!isValidGuestToken(guestToken, guestId)) {
        return res.status(401).json({
          message: 'Unauthorized guest chat history access.',
        });
      }
    }

    const messages = await LiveChatMessage.findAll({
      where: { guestId },
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    console.error('❌ Chat History Error:', error);
    res.status(500).json({ 
      message: 'Lỗi tải lịch sử chat', 
      details: error.message,
      stack: error.stack
    });
  }
});

// Admin: Mark all messages as read for a guest
router.put('/read/:guestId', protect, async (req, res) => {
  try {
    const { guestId } = req.params;
    await LiveChatMessage.update(
      { isRead: true },
      { where: { guestId, role: 'user', isRead: false } }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
