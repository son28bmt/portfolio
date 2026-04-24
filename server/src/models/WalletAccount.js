const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WalletAccount = sequelize.define(
  'WalletAccount',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'user_id',
    },
    balance: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('active', 'locked'),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    tableName: 'wallet_accounts',
  },
);

module.exports = WalletAccount;
