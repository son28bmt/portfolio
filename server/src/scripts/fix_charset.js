/**
 * Database Migration Script: Convert to utf8mb4
 * Run this with: node src/scripts/fix_charset.js
 */
const { sequelize } = require('../config/db');

async function fixCharset() {
  try {
    const dbName = sequelize.config.database;
    console.log(`🚀 Starting migration for database: ${dbName}...`);

    // 1. Convert Database charset
    await sequelize.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;`);
    console.log(`✅ Database ${dbName} converted to utf8mb4.`);

    // 2. Convert Projects table
    // Note: This converts the table and all its columns
    await sequelize.query(`ALTER TABLE \`Projects\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✅ Table 'Projects' converted to utf8mb4.`);

    // 3. (Optional) Convert other tables if they exist
    // You can add more tables here if needed, e.g., Blogs
    try {
      await sequelize.query(`ALTER TABLE \`Blogs\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      console.log(`✅ Table 'Blogs' converted to utf8mb4.`);
    } catch (e) {
      console.log(`ℹ️ Table 'Blogs' not found or skipped.`);
    }

    console.log('✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

fixCharset();
