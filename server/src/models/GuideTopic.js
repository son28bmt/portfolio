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
    validate: {
      is: {
        args: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        msg: 'Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang đơn.',
      },
    },
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
    beforeValidate: async (topic) => {
      if (topic.isNewRecord && !topic.slug) {
        const baseSlug = slugify(topic.name) || 'chu-de';
        let slug = baseSlug;
        let suffix = 2;

        while (await GuideTopic.findOne({ where: { slug } })) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }

        topic.slug = slug;
      }
    },
  },
});

module.exports = GuideTopic;
