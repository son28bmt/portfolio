const express = require('express');
const router = express.Router();
const { LiveChatMessage } = require('../models');
const { protect } = require('../middleware/auth.middleware');

// Public: Get chat history for a specific guest (No protect needed for guests to see their own history)
router.get('/history/:guestId', async (req, res) => {
  try {
    const { guestId } = req.params;
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
