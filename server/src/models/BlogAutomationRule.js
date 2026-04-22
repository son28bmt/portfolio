const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BlogAutomationRule = sequelize.define(
  'BlogAutomationRule',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    publishMode: {
      type: DataTypes.ENUM('publish', 'draft'),
      allowNull: false,
      defaultValue: 'publish',
    },
    modelProvider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'chatgpt',
    },
    modelName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    baseUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    topic: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    objective: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'chuyen nghiep, than thien',
    },
    targetAudience: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    keywords: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    wordCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1200,
      validate: {
        min: 300,
        max: 5000,
      },
    },
    postingTime: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '08:00',
    },
    postingTimes: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: ['08:00'],
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Asia/Ho_Chi_Minh',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastRunDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    tableName: 'blog_automation_rules',
  },
);

module.exports = BlogAutomationRule;
