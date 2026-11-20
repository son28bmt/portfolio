const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "portfolio",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    charset: "utf8mb4",
    dialectOptions: {
      charset: "utf8mb4",
    },
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
    },
    logging: false,
  },
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("MySQL connected successfully.");

    try {
      const { ensureLiveChatColumns } = require('../services/guide-schema.service');
      await ensureLiveChatColumns();
    } catch (schemaError) {
      console.error('[Schema] Live chat column repair failed; run server/scripts/sql/add-guest-chat-cleanup.sql:', schemaError?.message || schemaError);
    }

    if (process.env.AUTO_SCHEMA_BOOTSTRAP === 'true') {
      try {
        const { ensureGuideSchema } = require('../services/guide-schema.service');
        await ensureGuideSchema();
      } catch (schemaError) {
        console.error('[Schema] Automatic guide/support schema setup failed:', schemaError?.message || schemaError);
        return false;
      }
    }
    return true;
  } catch (error) {
    const retryMs = Number(process.env.DB_RETRY_MS || 5000);
    console.error(
      "Unable to connect to the database:",
      error?.message || error,
    );
    console.log(
      `Retry database connection in ${Math.round(retryMs / 1000)}s...`,
    );
    return new Promise((resolve) => {
      setTimeout(() => resolve(connectDB()), retryMs);
    });
  }
};

module.exports = { sequelize, connectDB };
