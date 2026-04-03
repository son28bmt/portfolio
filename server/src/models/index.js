const Category = require('./Category');
const Product = require('./Product');
const StockItem = require('./StockItem');
const Order = require('./Order');
const Admin = require('./Admin');
const User = require('./User');
const Blog = require('./Blog');
const Project = require('./Project');
const Message = require('./Message');
const Setting = require('./Setting');
const LiveChatMessage = require('./LiveChatMessage');

// Associations
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Product.hasMany(StockItem, { foreignKey: 'productId', as: 'stockItems' });
StockItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Product.hasMany(Order, { foreignKey: 'productId', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

StockItem.hasMany(Order, { foreignKey: 'stockItemId', as: 'orders' });
Order.belongsTo(StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });

module.exports = {
  Category,
  Product,
  StockItem,
  Order,
  Admin,
  User,
  Blog,
  Project,
  Message,
  Setting,
  Donation,
  LiveChatMessage
};
