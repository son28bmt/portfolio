const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const UserProfile = sequelize.define(
  'UserProfile',
  {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'user_id',
    },
    fullName: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    tier: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'standard',
    },
    registeredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'registered_at',
    },
  },
  {
    tableName: 'user_profiles',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  },
);

module.exports = UserProfile;
