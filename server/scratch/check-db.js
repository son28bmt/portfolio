const { Category, Product } = require('../src/models');
require('dotenv').config();

async function run() {
  try {
    const categories = await Category.findAll();
    console.log('Categories:', JSON.stringify(categories, null, 2));
    
    const topupProducts = await Product.findAll({
      where: { sourceType: 'supplier_api' }
    });
    console.log('Supplier Products Count:', topupProducts.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
