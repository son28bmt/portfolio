const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const slugify = require('../utils/slugify');

const Blog = sequelize.define('Blog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  excerpt: {
    type: DataTypes.TEXT,
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },
  date: {
    type: DataTypes.STRING,
  },
  readTime: {
    type: DataTypes.STRING,
  },
  tags: {
    type: DataTypes.JSON,
  },
  image: {
    type: DataTypes.TEXT('long'),
  },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'published', 'archived'),
    allowNull: false,
    defaultValue: 'published',
  },
  cmsVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'cms_version' },
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
    type: DataTypes.TEXT('long'),
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
  layout: { type: DataTypes.JSON, allowNull: true },
  contentJson: { type: DataTypes.JSON, allowNull: true, field: 'content_json' },
  layoutPostId: { type: DataTypes.UUID, allowNull: true, field: 'layout_post_id' },
}, {
  hooks: {
    beforeValidate: (blog) => {
      if (blog.title && !blog.slug) {
        blog.slug = slugify(blog.title) + '-' + Math.floor(Math.random() * 10000);
      }
    },
  }
});

const triggerSitemapSafe = () => {
  try {
    const { triggerAutoSitemapUpdate } = require('../../scripts/generate-sitemap');
    triggerAutoSitemapUpdate();
  } catch (err) {
    console.error('Auto-sitemap trigger error:', err?.message || err);
  }
};

Blog.afterCreate(() => {
  triggerSitemapSafe();
});

Blog.afterUpdate((instance) => {
  if (instance.changed('title') || instance.changed('slug')) {
    triggerSitemapSafe();
  }
});

Blog.afterDestroy(() => {
  triggerSitemapSafe();
});

module.exports = Blog;
