const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BlogAutomationJob = sequelize.define(
  'BlogAutomationJob',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sourceType: {
      type: DataTypes.ENUM('manual', 'rule'),
      allowNull: false,
      defaultValue: 'manual',
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
    ruleId: {
      type: DataTypes.UUID,
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
    },
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'succeeded', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    blogId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'blog_automation_jobs',
  },
);

module.exports = BlogAutomationJob;
