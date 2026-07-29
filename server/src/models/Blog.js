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
}, {
  hooks: {
    beforeValidate: (blog) => {
      if (blog.title && !blog.slug) {
        blog.slug = slugify(blog.title) + '-' + Math.floor(Math.random() * 10000);
      }
    },
    beforeUpdate: (blog) => {
      if (blog.changed('title')) {
        blog.slug = slugify(blog.title) + '-' + Math.floor(Math.random() * 10000);
      }
    }
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
