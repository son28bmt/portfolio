const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PostRevision = sequelize.define('PostRevision', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  postType: {
    type: DataTypes.ENUM('blog', 'guide'),
    allowNull: false,
    field: 'post_type',
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'post_id',
  },
  action: {
    type: DataTypes.ENUM('created', 'updated', 'published', 'scheduled', 'archived', 'restored', 'autosaved'),
    allowNull: false,
    defaultValue: 'updated',
  },
  snapshot: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  authorId: {
    type: DataTypes.STRING(191),
    allowNull: true,
    field: 'author_id',
  },
}, {
  tableName: 'post_revisions',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PostRevision;