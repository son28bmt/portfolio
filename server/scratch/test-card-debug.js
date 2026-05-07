const { getCardBalance } = require('../src/services/card-partner.service');
require('dotenv').config();

async function run() {
  try {
    console.log('--- CARD PROVIDER DEBUG ---');
    const balance = await getCardBalance();
    console.log('Card Balance Result:', JSON.stringify(balance, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Card Balance Check Failed:', error.message);
    process.exit(1);
  }
}

run();
