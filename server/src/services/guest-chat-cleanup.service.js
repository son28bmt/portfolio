const { Op } = require('sequelize');
const { LiveChatMessage } = require('../models');

const GUEST_CHAT_RETENTION_MS = 10 * 60 * 1000;

const scheduleGuestConversationCleanup = (guestId, now = new Date()) => {
  if (!guestId || String(guestId).startsWith('user_')) {
    const error = new Error('Chỉ hội thoại guest mới được hẹn xóa.');
    error.status = 400;
    throw error;
  }
  return new Date(now.getTime() + GUEST_CHAT_RETENTION_MS);
};

const cleanupExpiredGuestChats = async (now = new Date()) => {
  const expiredIds = await LiveChatMessage.findAll({
    where: { guestCleanupAt: { [Op.lte]: now }, userId: null },
    attributes: ['guestId'],
    group: ['guestId'],
    raw: true,
  });

  let deleted = 0;
  for (const { guestId } of expiredIds) {
    const deletedForGuest = await LiveChatMessage.sequelize.transaction(async transaction => {
      const messages = await LiveChatMessage.findAll({
        where: { guestId },
        attributes: ['id', 'userId', 'guestCleanupAt'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!messages.length || messages.some(message => message.userId)) return 0;
      if (!messages.some(message => message.guestCleanupAt && message.guestCleanupAt <= now)) return 0;
      return LiveChatMessage.destroy({ where: { guestId }, transaction });
    });
    deleted += deletedForGuest;
    if (deletedForGuest) {
      try {
        const { getIO } = require('./socket.service');
        getIO().to(`room_${guestId}`).emit('guest_chat_deleted', { guestId });
        getIO().to('admin_room').emit('guest_chat_deleted', { guestId });
      } catch {
        // The cleanup worker can run before Socket.IO is initialized.
      }
    }
  }
  return deleted;
};

module.exports = {
  GUEST_CHAT_RETENTION_MS,
  scheduleGuestConversationCleanup,
  cleanupExpiredGuestChats,
};