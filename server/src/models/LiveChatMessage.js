const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LiveChatMessage = sequelize.define('LiveChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  guestId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },
  messageType: {
    type: DataTypes.ENUM('text', 'guide_question'),
    allowNull: true,
  },
  guideContext: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  questionSnapshot: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  replyContext: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  guestCleanupAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  purchaseStatus: {
    type: DataTypes.ENUM('unknown', 'purchased', 'not_purchased'),
    allowNull: true,
  },
  assignedBy: {
    type: DataTypes.STRING(191),
    allowNull: true,
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  assignmentNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  packageType: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  printerModel: {
    type: DataTypes.STRING(160),
    allowNull: true,
  },
}, {
  indexes: [
    {
      fields: ['guestId'],
    },
    { fields: ['userId'] },
  ]
});

module.exports = LiveChatMessage;
