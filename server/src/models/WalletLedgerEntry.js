const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WalletLedgerEntry = sequelize.define(
  'WalletLedgerEntry',
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
    direction: {
      type: DataTypes.ENUM('credit', 'debit'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    balanceBefore: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'balance_before',
    },
    balanceAfter: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'balance_after',
    },
    type: {
      type: DataTypes.ENUM('topup', 'purchase', 'adjustment'),
      allowNull: false,
    },
    refType: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'ref_type',
    },
    refId: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'ref_id',
    },
    idempotencyKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'wallet_ledger_entries',
  },
);

module.exports = WalletLedgerEntry;
