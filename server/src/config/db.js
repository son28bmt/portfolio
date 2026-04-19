const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'portfolio',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
  }
);

const shouldSyncOnStart = String(process.env.DB_SYNC_ON_START || '').toLowerCase() === 'true';
const shouldAlterOnSync = String(process.env.DB_SYNC_ALTER || '').toLowerCase() === 'true';
let hasAttemptedSync = false;

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected successfully.');

    if (!shouldSyncOnStart || hasAttemptedSync) {
      return;
    }

    hasAttemptedSync = true;
    try {
      await sequelize.sync({ alter: shouldAlterOnSync });
      console.log(`MySQL schema synced (alter=${shouldAlterOnSync}).`);
    } catch (syncError) {
      console.error('Schema sync skipped:', syncError?.message || syncError);
    }
  } catch (error) {
    const retryMs = Number(process.env.DB_RETRY_MS || 5000);
    console.error('Unable to connect to the database:', error?.message || error);
    console.log(`Retry database connection in ${Math.round(retryMs / 1000)}s...`);
    setTimeout(connectDB, retryMs);
  }
};

module.exports = { sequelize, connectDB };
