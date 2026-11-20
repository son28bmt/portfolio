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

const ensureIndex = async (tableName, indexName, fields, unique = false) => {
  const queryInterface = sequelize.getQueryInterface();
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some(index => index.name === indexName)) return;
  await queryInterface.addIndex(tableName, fields, { name: indexName, unique });
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
    await ensureColumn('user_profiles', 'google_sub', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
    await ensureIndex('user_profiles', 'user_profiles_google_sub_unique', ['google_sub'], true);

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
