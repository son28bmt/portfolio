const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const StockItem = sequelize.define('StockItem', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  productId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'product_id',
  },
  data: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('available', 'sold'),
    allowNull: false,
    defaultValue: 'available',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'stock_items',
  timestamps: false,
});

module.exports = StockItem;
