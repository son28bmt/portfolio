const rateLimit = require('express-rate-limit');
const { verifyTurnstile } = require('../middleware/turnstile.middleware');

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5, // Tối đa 5 tin nhắn mỗi IP mỗi giờ
  message: { message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng đợi 1 tiếng nữa nhé!' }
});

// Public: Submit contact form
router.post('/', contactLimiter, verifyTurnstile, async (req, res) => {
  try {
    const { name, email, subject, message: content } = req.body;
    if (!name || !email || !content) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ các trường bắt buộc.' });
    }
    const message = await Message.create(req.body);
    res.status(201).json({ message: 'Cảm ơn bạn! Tin nhắn đã được gửi tới Sơn.' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin: Get all messages
router.get('/', protect, async (req, res) => {
  try {
    const messages = await Message.findAll({ order: [['createdAt', 'DESC']] });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Update message status (mark as read)
router.put('/:id', protect, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    
    await message.update({ status: 'read' });
    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
