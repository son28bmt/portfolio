const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LayoutPost = sequelize.define('LayoutPost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  templateId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'template_id',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  layout: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  content: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'published'),
    allowNull: false,
    defaultValue: 'draft',
  },
  publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
  createdBy: {
    type: DataTypes.STRING(191),
    allowNull: true,
    field: 'created_by',
  },
  publishTarget: { type: DataTypes.ENUM('blog', 'guide'), allowNull: false, defaultValue: 'blog', field: 'publish_target' },
  publishedPostId: { type: DataTypes.UUID, allowNull: true, field: 'published_post_id' },
  publishedPostSlug: { type: DataTypes.STRING(191), allowNull: true, field: 'published_post_slug' },
}, {
  tableName: 'layout_posts',
  timestamps: true,
  underscored: true,
});

module.exports = LayoutPost;