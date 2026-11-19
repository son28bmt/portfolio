const { Op } = require('sequelize');
const { LiveChatMessage, Order } = require('../models');

const PURCHASED = 'purchased';

const normalizeEmail = value => String(value || '').trim().toLowerCase();

const getConversationSnapshot = async (guestId) => {
  const latest = await LiveChatMessage.findOne({
    where: { guestId },
    order: [['createdAt', 'DESC']],
    attributes: ['guestId', 'userId', 'name', 'email', 'purchaseStatus', 'assignedBy', 'assignedAt', 'assignmentNotes', 'packageType', 'printerModel'],
  });
  if (!latest) return null;

  const email = normalizeEmail(latest.email);
  const orderWhere = {
    status: 'paid',
    fulfillmentStatus: 'delivered',
    [Op.or]: [
      ...(latest.userId ? [{ userId: latest.userId }] : []),
      ...(email ? [{ email }] : []),
    ],
  };
  const orderCount = await Order.count({ where: orderWhere });
  const manualStatus = latest.purchaseStatus;
  const status = manualStatus && manualStatus !== 'unknown'
    ? manualStatus
    : (orderCount > 0 ? PURCHASED : (manualStatus || 'not_purchased'));

  return {
    guestId,
    userId: latest.userId || null,
    name: latest.name || guestId,
    email: latest.email || null,
    purchaseStatus: status,
    automaticPurchase: orderCount > 0,
    paidDeliveredOrderCount: orderCount,
    assignedBy: latest.assignedBy || null,
    assignedAt: latest.assignedAt || null,
    assignmentNotes: latest.assignmentNotes || null,
    packageType: latest.packageType || null,
    printerModel: latest.printerModel || null,
  };
};

const assignConversationPurchase = async (guestId, payload, actorId) => {
  const purchaseStatus = String(payload.purchaseStatus || '').trim();
  if (!['purchased', 'not_purchased', 'unknown'].includes(purchaseStatus)) {
    const error = new Error('purchaseStatus không hợp lệ.');
    error.status = 400;
    throw error;
  }

  const [updated] = await LiveChatMessage.update({
    purchaseStatus,
    assignedBy: String(actorId || ''),
    assignedAt: new Date(),
    assignmentNotes: payload.assignmentNotes == null ? null : String(payload.assignmentNotes).trim().slice(0, 2000),
    packageType: payload.packageType == null ? null : String(payload.packageType).trim().slice(0, 120),
    printerModel: payload.printerModel == null ? null : String(payload.printerModel).trim().slice(0, 160),
  }, { where: { guestId } });

  if (!updated) {
    const error = new Error('Không tìm thấy cuộc hội thoại.');
    error.status = 404;
    throw error;
  }
  return getConversationSnapshot(guestId);
};

module.exports = { getConversationSnapshot, assignConversationPurchase };