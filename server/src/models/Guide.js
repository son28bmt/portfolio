const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/db');
const slugify = require('../utils/slugify');

const Guide = sequelize.define('Guide', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  slug: {
    type: DataTypes.STRING(191),
    allowNull: false,
    unique: true,
    validate: {
      is: {
        args: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        msg: 'Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang đơn.',
      },
    },
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  excerpt: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  topicId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'topic_id',
  },
  status: {
    type: DataTypes.ENUM('draft', 'published'),
    allowNull: false,
    defaultValue: 'draft',
  },
  readTime: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '5 min',
    field: 'read_time',
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'published_at',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'guides',
  timestamps: true,
  hooks: {
    beforeValidate: (guide) => {
      if (guide.isNewRecord && !guide.slug) {
        const baseSlug = slugify(guide.title) || 'huong-dan';
        const suffix = crypto.randomBytes(3).toString('hex');
        guide.slug = `${baseSlug}-${suffix}`;
      }
    },
  },
});

module.exports = Guide;
