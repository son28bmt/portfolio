const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  productId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'product_id',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id',
  },
  stockItemId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'stock_item_id',
  },
  walletLedgerEntryId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'wallet_ledger_entry_id',
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentMethod: {
    type: DataTypes.ENUM('qr', 'wallet'),
    allowNull: false,
    defaultValue: 'qr',
    field: 'payment_method',
  },
  fulfillmentStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'delivered', 'failed', 'manual_review'),
    allowNull: false,
    defaultValue: 'pending',
  },
  fulfillmentSource: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  fulfillmentPayload: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  productSnapshot: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  sourceSnapshot: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  payment_ref: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  payment_txn_id: {
    type: DataTypes.STRING(191),
    allowNull: true,
    unique: true,
  },
  amount: {
    type: DataTypes.DECIMAL(15, 0),
    allowNull: false,
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'orders',
  timestamps: false,
});

module.exports = Order;
