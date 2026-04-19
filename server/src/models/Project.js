const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Separate accents from characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[đĐ]/g, 'd')
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove remaining non-word chars
    .replace(/--+/g, '-') // Avoid multiple dashes
    .replace(/^-+/, '') // Trim dash from start
    .replace(/-+$/, ''); // Trim dash from end
};

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tech: {
    type: DataTypes.JSON, // Stores array as JSON string
    allowNull: false,
  },
  github: {
    type: DataTypes.STRING,
  },
  demo: {
    type: DataTypes.STRING,
  },
  image: {
    type: DataTypes.TEXT('long'),
  },
  images: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  apkUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  iosUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  apkDownloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  iosDownloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

Project.beforeValidate((project) => {
  if (project.title && !project.slug) {
    project.slug = slugify(project.title);
  }
});

module.exports = Project;
