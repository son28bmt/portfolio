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
  }
);

let hasSynced = false;

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected successfully.');

    // Sync models once after first successful connection.
    if (!hasSynced) {
      await sequelize.sync({ alter: true });
      hasSynced = true;
      console.log('✅ MySQL schema synced.');
    }
  } catch (error) {
    const retryMs = Number(process.env.DB_RETRY_MS || 5000);
    console.error('❌ Unable to connect to the database:', error?.message || error);
    console.log(`⏳ Retry database connection in ${Math.round(retryMs / 1000)}s...`);
    setTimeout(connectDB, retryMs);
  }
};

module.exports = { sequelize, connectDB };
