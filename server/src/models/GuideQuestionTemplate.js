const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const GuideQuestionTemplate = sequelize.define('GuideQuestionTemplate', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  guideId: { type: DataTypes.UUID, allowNull: true, field: 'guide_id' },
  name: { type: DataTypes.STRING(160), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  fields: { type: DataTypes.JSON, allowNull: false },
  createdBy: { type: DataTypes.STRING(191), allowNull: true, field: 'created_by' },
}, {
  tableName: 'guide_question_templates',
  timestamps: true,
  underscored: true,
});

module.exports = GuideQuestionTemplate;