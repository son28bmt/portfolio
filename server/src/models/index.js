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
const Donation = require('./Donation');
const LiveChatMessage = require('./LiveChatMessage');
const BlogAutomationRule = require('./BlogAutomationRule');
const BlogAutomationJob = require('./BlogAutomationJob');
const UserProfile = require('./UserProfile');
const WalletAccount = require('./WalletAccount');
const WalletLedgerEntry = require('./WalletLedgerEntry');
const WalletTopup = require('./WalletTopup');
const GuideTopic = require('./GuideTopic');
const Guide = require('./Guide');
const GuideQuestionTemplate = require('./GuideQuestionTemplate');
const PostRevision = require('./PostRevision');
const LayoutTemplate = require('./LayoutTemplate');
const LayoutPost = require('./LayoutPost');

// Associations
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Product.hasMany(StockItem, { foreignKey: 'productId', as: 'stockItems' });
StockItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Product.hasMany(Order, { foreignKey: 'productId', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

StockItem.hasMany(Order, { foreignKey: 'stockItemId', as: 'orders' });
Order.belongsTo(StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });

User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile' });
UserProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasOne(WalletAccount, { foreignKey: 'userId', as: 'walletAccount' });
WalletAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

WalletAccount.hasMany(WalletLedgerEntry, {
  foreignKey: 'walletAccountId',
  as: 'ledgerEntries',
});
WalletLedgerEntry.belongsTo(WalletAccount, {
  foreignKey: 'walletAccountId',
  as: 'walletAccount',
});

WalletAccount.hasMany(WalletTopup, {
  foreignKey: 'walletAccountId',
  as: 'topups',
});
WalletTopup.belongsTo(WalletAccount, {
  foreignKey: 'walletAccountId',
  as: 'walletAccount',
});

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(LiveChatMessage, { foreignKey: 'userId', as: 'chatMessages' });
LiveChatMessage.belongsTo(User, { foreignKey: 'userId', as: 'user' });

WalletLedgerEntry.hasMany(Order, {
  foreignKey: 'walletLedgerEntryId',
  as: 'orders',
});
Order.belongsTo(WalletLedgerEntry, {
  foreignKey: 'walletLedgerEntryId',
  as: 'walletLedgerEntry',
});

BlogAutomationRule.hasMany(BlogAutomationJob, {
  foreignKey: 'ruleId',
  as: 'jobs',
  constraints: false,
});
BlogAutomationJob.belongsTo(BlogAutomationRule, {
  foreignKey: 'ruleId',
  as: 'rule',
  constraints: false,
});
Blog.hasMany(BlogAutomationJob, {
  foreignKey: 'blogId',
  as: 'automationJobs',
  constraints: false,
});
BlogAutomationJob.belongsTo(Blog, {
  foreignKey: 'blogId',
  as: 'blog',
  constraints: false,
});

GuideTopic.hasMany(Guide, {
  foreignKey: { name: 'topicId', field: 'topic_id' },
  as: 'guides',
  onDelete: 'SET NULL',
});
Guide.belongsTo(GuideTopic, {
  foreignKey: { name: 'topicId', field: 'topic_id' },
  as: 'topic',
  onDelete: 'SET NULL',
});
Guide.hasMany(GuideQuestionTemplate, { foreignKey: 'guideId', as: 'questionTemplates' });
GuideQuestionTemplate.belongsTo(Guide, { foreignKey: 'guideId', as: 'guide' });

LayoutTemplate.hasMany(LayoutPost, { foreignKey: 'templateId', as: 'posts', onDelete: 'RESTRICT' });
LayoutPost.belongsTo(LayoutTemplate, { foreignKey: 'templateId', as: 'template', onDelete: 'RESTRICT' });

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
  LiveChatMessage,
  BlogAutomationRule,
  BlogAutomationJob,
  UserProfile,
  WalletAccount,
  WalletLedgerEntry,
  WalletTopup,
  GuideTopic,
  Guide,
  GuideQuestionTemplate,
  PostRevision,
  LayoutTemplate,
  LayoutPost,
};
