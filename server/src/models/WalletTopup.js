const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WalletTopup = sequelize.define(
  'WalletTopup',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    walletAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'wallet_account_id',
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    paymentRef: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      field: 'payment_ref',
    },
    provider: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'sepay',
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'expired', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    providerTxnId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      unique: true,
      field: 'provider_txn_id',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'paid_at',
    },
    rawWebhook: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'raw_webhook',
    },
  },
  {
    tableName: 'wallet_topups',
  },
);

module.exports = WalletTopup;
