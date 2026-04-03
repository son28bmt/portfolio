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
    index: true,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
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
});

module.exports = LiveChatMessage;
