const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/auth.middleware');

// Public: Submit contact form
router.post('/', async (req, res) => {
  try {
    const message = await Message.create(req.body);
    res.status(201).json({ message: 'Message sent successfully' });
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
