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
    type: DataTypes.ENUM('draft', 'scheduled', 'published', 'archived'),
    allowNull: false,
    defaultValue: 'draft',
  },
  cmsVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'cms_version' },
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
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scheduled_at',
  },
  authorId: {
    type: DataTypes.STRING(191),
    allowNull: true,
    field: 'author_id',
  },
  seoTitle: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'seo_title',
  },
  seoDescription: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'seo_description',
  },
  ogImage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'og_image',
  },
  canonicalUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'canonical_url',
  },
  coverAlt: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'cover_alt',
  },
  coverCaption: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'cover_caption',
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
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
        if (typeof guide.title !== 'string' || !guide.title.trim()) return;

        const baseSlug = (slugify(guide.title) || 'huong-dan')
          .slice(0, 150)
          .replace(/-+$/, '') || 'huong-dan';
        const suffix = crypto.randomBytes(3).toString('hex');
        guide.slug = `${baseSlug}-${suffix}`;
      }
    },
  },
});

module.exports = Guide;
