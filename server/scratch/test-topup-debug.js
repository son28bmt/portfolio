const { listTopupProducts, getTopupBalance } = require('../src/services/card-partner.service');
const { sequelize } = require('../src/config/db');
require('dotenv').config();

async function run() {
  try {
    console.log('--- TOPUP PROVIDER DEBUG ---');
    
    console.log('1. Checking Topup Balance...');
    try {
      const balance = await getTopupBalance();
      console.log('Balance Result:', JSON.stringify(balance, null, 2));
    } catch (e) {
      console.error('Balance Check Failed:', e.message);
    }

    console.log('\n2. Checking Topup Product List...');
    try {
      const products = await listTopupProducts();
      console.log('Products Count:', products.length);
      if (products.length > 0) {
        console.log('First Product:', JSON.stringify(products[0], null, 2));
      } else {
        console.log('No products returned.');
      }
    } catch (e) {
      console.error('Product List Check Failed:', e.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('Unexpected Error:', error);
    process.exit(1);
  }
}

run();
