const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Donation = sequelize.define('Donation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderCode: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
  },
  donorName: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'expired', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  transferContent: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  provider: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'sepay',
  },
  providerTxnId: {
    type: DataTypes.STRING(120),
    allowNull: true,
    unique: true,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  rawWebhook: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
});

module.exports = Donation;
