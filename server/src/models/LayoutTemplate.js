const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const LayoutTemplate = sequelize.define('LayoutTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  blocks: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  schemaVersion: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 1,
    field: 'schema_version',
  },
  createdBy: { type: DataTypes.STRING(191), allowNull: true, field: 'created_by' },
}, {
  tableName: 'layout_templates',
  timestamps: true,
  underscored: true,
});

module.exports = LayoutTemplate;