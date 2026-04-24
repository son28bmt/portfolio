const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

let schemaEnsured = false;
let schemaEnsuringPromise = null;

const ensureColumn = async (tableName, columnName, definition) => {
  const queryInterface = sequelize.getQueryInterface();
  const description = await queryInterface.describeTable(tableName);
  if (description[columnName]) return;
  await queryInterface.addColumn(tableName, columnName, definition);
};

const ensureMarketplaceSchema = async () => {
  if (schemaEnsured) return;
  if (schemaEnsuringPromise) {
    await schemaEnsuringPromise;
    return;
  }

  schemaEnsuringPromise = (async () => {
    await ensureColumn('products', 'sourceType', {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'local_stock',
    });

    await ensureColumn('products', 'sourceConfig', {
      type: DataTypes.JSON,
      allowNull: true,
    });

    await ensureColumn('categories', 'store_section', {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'service',
    });

    await ensureColumn('orders', 'fulfillmentStatus', {
      type: DataTypes.ENUM('pending', 'processing', 'delivered', 'failed', 'manual_review'),
      allowNull: false,
      defaultValue: 'pending',
    });

    await ensureColumn('orders', 'fulfillmentSource', {
      type: DataTypes.STRING(40),
      allowNull: true,
    });

    await ensureColumn('orders', 'fulfillmentPayload', {
      type: DataTypes.JSON,
      allowNull: true,
    });

    await ensureColumn('orders', 'productSnapshot', {
      type: DataTypes.JSON,
      allowNull: true,
    });

    await ensureColumn('orders', 'sourceSnapshot', {
      type: DataTypes.JSON,
      allowNull: true,
    });

    schemaEnsured = true;
    console.log('[Marketplace] Schema checked and upgraded.');
  })();

  try {
    await schemaEnsuringPromise;
  } finally {
    schemaEnsuringPromise = null;
  }
};

module.exports = {
  ensureMarketplaceSchema,
};
