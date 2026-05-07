const { syncTopupCatalogToMarketplace } = require('../src/services/marketplace-topup-sync.service');
const { sequelize } = require('../src/config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('Starting Topup Sync...');
    const result = await syncTopupCatalogToMarketplace({
      updateExisting: true
    });
    console.log('Sync Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Sync Failed:', error);
    process.exit(1);
  }
}

run();
