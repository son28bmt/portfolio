const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const slugify = require('../utils/slugify');

const GuideTopic = sequelize.define('GuideTopic', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order',
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_visible',
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
  tableName: 'guide_topics',
  timestamps: true,
  hooks: {
    beforeValidate: (topic) => {
      if (topic.name && !topic.slug) {
        topic.slug = `${slugify(topic.name)}-${Math.floor(Math.random() * 10000)}`;
      }
    },
    beforeUpdate: (topic) => {
      if (topic.changed('name')) {
        topic.slug = `${slugify(topic.name)}-${Math.floor(Math.random() * 10000)}`;
      }
    },
  },
});

module.exports = GuideTopic;
