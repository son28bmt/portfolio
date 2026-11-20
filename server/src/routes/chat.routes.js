const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { LiveChatMessage } = require('../models');
const { protect } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/require-admin.middleware');
const { getJwtSecret } = require('../utils/jwt.util');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const { assignConversationPurchase, getConversationSnapshot } = require('../services/chat-purchase.service');
const { submitGuideQuestion } = require('../services/guide-question.service');
const rateLimit = require('express-rate-limit');

const guideQuestionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.user?.id || req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau.' },
  validate: { default: false },
});

const optionalProtect = async (req, res, next) => {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return next();
  return protect(req, res, next);
};

const isValidGuestToken = (token, guestId) => {
  if (!token || !guestId) return false;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
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
    const isAdminRequest = ['owner', 'support'].includes(req.user?.role);

    if (req.user && !isAdminRequest) {
      return res.status(403).json({ message: 'Bạn không có quyền xem hội thoại hỗ trợ.' });
    }

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
router.put('/read/:guestId', protect, requireRoles('owner', 'support'), async (req, res) => {
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

router.get('/unread/:guestId', optionalProtect, async (req, res) => {
  const { guestId } = req.params;
  const guestToken = String(req.headers['x-guest-token'] || req.query.guest_token || '').trim();
  if (!isValidGuestToken(guestToken, guestId)) {
    return res.status(401).json({ message: 'Phiên chat không hợp lệ hoặc đã hết hạn.' });
  }
  try {
    const count = await LiveChatMessage.count({ where: { guestId, role: 'admin', isRead: false } });
    return res.json({ unreadCount: count });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tải số tin nhắn chưa đọc.' });
  }
});

router.put('/read-user/:guestId', optionalProtect, async (req, res) => {
  const { guestId } = req.params;
  const guestToken = String(req.headers['x-guest-token'] || req.query.guest_token || '').trim();
  if (!isValidGuestToken(guestToken, guestId)) {
    return res.status(401).json({ message: 'Phiên chat không hợp lệ hoặc đã hết hạn.' });
  }
  try {
    await LiveChatMessage.update(
      { isRead: true },
      { where: { guestId, role: 'admin', isRead: false } },
    );
    return res.json({ message: 'Marked as read' });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể đánh dấu tin nhắn đã đọc.' });
  }
});

router.get('/purchase-status/:guestId', protect, requireAdmin, async (req, res) => {
  try {
    const data = await getConversationSnapshot(req.params.guestId);
    return data ? res.json(data) : res.status(404).json({ message: 'Không tìm thấy cuộc hội thoại.' });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tải trạng thái khách mua.' });
  }
});

router.patch('/purchase-status/:guestId', protect, requireAdmin, async (req, res) => {
  try {
    const data = await assignConversationPurchase(req.params.guestId, req.body || {}, req.user.id);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể cập nhật trạng thái khách mua.' });
  }
});

router.post('/guide-question', protect, guideQuestionLimiter, async (req, res) => {
  try {
    const guestId = String(req.body?.guestId || '').trim();
    const guestToken = String(req.headers['x-guest-token'] || '').trim();
    if (!isValidGuestToken(guestToken, guestId)) {
      return res.status(401).json({ message: 'Phiên chat không hợp lệ hoặc đã hết hạn. Hãy tải lại trang và thử lại.' });
    }
    const previousMessage = await LiveChatMessage.findOne({
      where: { guestId },
      order: [['createdAt', 'DESC']],
      attributes: ['userId'],
    });
    if (previousMessage?.userId && String(previousMessage.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Phiên chat này đã được liên kết với tài khoản khác.' });
    }
    const data = await submitGuideQuestion({
      user: { id: req.user.id, username: req.user.username },
      guestId,
      guideSlug: req.body?.guideSlug,
      templateId: req.body?.templateId,
      answers: req.body?.answers,
    });
    return res.status(201).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể gửi câu hỏi.' });
  }
});

module.exports = router;
