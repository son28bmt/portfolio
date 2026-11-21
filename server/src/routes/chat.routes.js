const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { LiveChatMessage, LayoutPost, UserProfile } = require('../models');
const { protect } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/require-admin.middleware');
const { getJwtSecret } = require('../utils/jwt.util');
const { requireAdmin } = require('../middleware/require-admin.middleware');
const { assignConversationPurchase, getConversationSnapshot } = require('../services/chat-purchase.service');
const { submitGuideQuestion, findReusableTemplate, validateAnswerValues, formatSupportRequestNumber } = require('../services/guide-question.service');
const { emitSupportRequest } = require('../services/socket.service');
const { scheduleGuestConversationCleanup } = require('../services/guest-chat-cleanup.service');
const { notifyAdmin } = require('../services/socket.service');
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

const accountChatId = userId => `user_${userId}`;

const authorizeConversation = (req, guestId) => {
  const isAdminRequest = ['owner', 'support'].includes(req.user?.role);
  if (isAdminRequest) return { isAdminRequest, isAccountChat: guestId.startsWith('user_') };
  if (req.user) {
    if (guestId !== accountChatId(req.user.id)) return null;
    return { isAdminRequest: false, isAccountChat: true };
  }
  const guestToken = String(req.headers['x-guest-token'] || req.query.guest_token || '').trim();
  if (guestId.startsWith('user_') || !isValidGuestToken(guestToken, guestId)) return null;
  return { isAdminRequest: false, isAccountChat: false };
};

router.get('/history/:guestId', optionalProtect, async (req, res) => {
  try {
    const { guestId } = req.params;
    if (!authorizeConversation(req, guestId)) {
      return res.status(403).json({ message: 'Bạn không có quyền xem hội thoại hỗ trợ này.' });
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
  if (!authorizeConversation(req, guestId)) {
    return res.status(403).json({ message: 'Bạn không có quyền xem tin nhắn chưa đọc của hội thoại này.' });
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
  if (!authorizeConversation(req, guestId)) {
    return res.status(403).json({ message: 'Bạn không có quyền cập nhật hội thoại này.' });
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

router.post('/complete/:guestId', protect, requireRoles('owner', 'support'), async (req, res) => {
  const { guestId } = req.params;
  if (guestId.startsWith('user_')) {
    return res.status(400).json({ message: 'Hội thoại tài khoản được lưu giữ và không cần hẹn xóa.' });
  }
  try {
    const accountMessages = await LiveChatMessage.count({ where: { guestId, userId: { [Op.ne]: null } } });
    if (accountMessages) return res.status(400).json({ message: 'Hội thoại có liên kết tài khoản nên không thể hẹn xóa.' });
    const guestCleanupAt = scheduleGuestConversationCleanup(guestId);
    const [affected] = await LiveChatMessage.update({ guestCleanupAt }, { where: { guestId } });
    if (!affected) return res.status(404).json({ message: 'Không tìm thấy hội thoại guest.' });
    notifyAdmin('guest_support_completed', { guestId, guestCleanupAt });
    return res.json({ guestCleanupAt });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể kết thúc hỗ trợ guest.' });
  }
});

const registerQuestionRoutes = (target, {
  protectMiddleware = protect,
  limiter = guideQuestionLimiter,
  PostModel = LayoutPost,
  ProfileModel = UserProfile,
  MessageModel = LiveChatMessage,
  submitGuide = submitGuideQuestion,
  findTemplate = findReusableTemplate,
  validateValues = validateAnswerValues,
  formatRequestNumber = formatSupportRequestNumber,
  emitRequest = emitSupportRequest,
} = {}) => {
target.post('/guide-question', protectMiddleware, limiter, async (req, res) => {
  try {
    const guestId = accountChatId(req.user.id);
    const data = await submitGuide({
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

target.post('/layout-post-question', protectMiddleware, limiter, async (req, res) => {
  try {
    const post = await PostModel.findOne({ where: { id: req.body?.postId, status: 'published' }, attributes: ['id', 'title', 'layout'] });
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết đã đăng.' });
    const block = (post.layout || []).find(item => item.type === 'question');
    const templateId = block?.props?.templateId;
    const template = templateId ? await findTemplate(templateId) : null;
    if (!template) return res.status(404).json({ message: 'Bộ câu hỏi không tồn tại hoặc đã tắt.' });
    const profile = await ProfileModel.findByPk(req.user.id, { attributes: ['email'] });
    const email = String(profile?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Hãy thêm email hợp lệ vào hồ sơ tài khoản trước khi gửi câu hỏi.' });
    const snapshot = validateValues(template.fields, req.body?.values);
    const id = require('crypto').randomUUID();
    const requestNumber = formatRequestNumber(id);
    const text = snapshot.map(item => `${item.label}: ${item.value || '(bỏ trống)'}`).join('\n');
    const message = await MessageModel.create({ id, guestId: `user_${req.user.id}`, userId: req.user.id, role: 'user', messageType: 'guide_question', content: text, name: req.user.username, email, guideContext: { kind: 'layout_post', id: post.id, title: post.title, url: `/bai-viet/${post.id}` }, questionSnapshot: { templateId: template.id, templateName: template.name, requestNumber, fields: snapshot } });
    emitRequest({ guestId: message.guestId, request: { id: message.id, guestId: message.guestId, userId: req.user.id, isAccountChat: true, text, name: message.name, email, messageType: 'guide_question', timestamp: message.createdAt, guideContext: message.guideContext, questionSnapshot: message.questionSnapshot } });
    return res.status(201).json({ id: message.id, requestNumber, createdAt: message.createdAt });
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể gửi câu hỏi.' }); }
});
return target;
};

registerQuestionRoutes(router);

module.exports = router;
module.exports.registerQuestionRoutes = registerQuestionRoutes;
