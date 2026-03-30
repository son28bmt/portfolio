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
  stockItemId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'stock_item_id',
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
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
