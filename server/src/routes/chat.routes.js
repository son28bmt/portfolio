const express = require('express');
const router = express.Router();
const { LiveChatMessage } = require('../models');
const { protect } = require('../middleware/auth.middleware');

// Admin: Get chat history for a specific guest
router.get('/history/:guestId', protect, async (req, res) => {
  try {
    const { guestId } = req.params;
    const messages = await LiveChatMessage.findAll({
      where: { guestId },
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
