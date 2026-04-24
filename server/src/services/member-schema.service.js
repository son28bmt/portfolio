const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const {
  UserProfile,
  WalletAccount,
  WalletLedgerEntry,
  WalletTopup,
} = require('../models');

let schemaEnsured = false;
let schemaEnsuringPromise = null;

const ensureTableExists = async (model, tableName) => {
  try {
    await sequelize.getQueryInterface().describeTable(tableName);
  } catch {
    await model.sync();
  }
};

const ensureColumn = async (tableName, columnName, definition) => {
  const queryInterface = sequelize.getQueryInterface();
  const description = await queryInterface.describeTable(tableName);
  if (description[columnName]) return;
  await queryInterface.addColumn(tableName, columnName, definition);
};

const ensureMemberSchema = async () => {
  if (schemaEnsured) return;
  if (schemaEnsuringPromise) {
    await schemaEnsuringPromise;
    return;
  }

  schemaEnsuringPromise = (async () => {
    await ensureTableExists(UserProfile, 'user_profiles');
    await ensureTableExists(WalletAccount, 'wallet_accounts');
    await ensureTableExists(WalletLedgerEntry, 'wallet_ledger_entries');
    await ensureTableExists(WalletTopup, 'wallet_topups');

    await ensureColumn('orders', 'user_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });

    await ensureColumn('orders', 'wallet_ledger_entry_id', {
      type: DataTypes.UUID,
      allowNull: true,
    });

    await ensureColumn('orders', 'payment_method', {
      type: DataTypes.ENUM('qr', 'wallet'),
      allowNull: false,
      defaultValue: 'qr',
    });

    schemaEnsured = true;
    console.log('[Member] Schema checked and upgraded.');
  })();

  try {
    await schemaEnsuringPromise;
  } finally {
    schemaEnsuringPromise = null;
  }
};

module.exports = {
  ensureMemberSchema,
};
