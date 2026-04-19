const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Project = sequelize.define("Project", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
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
    type: DataTypes.TEXT("long"),
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

module.exports = Project;
