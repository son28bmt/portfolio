const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'admins',
  timestamps: false,
  hooks: {
    async beforeCreate(admin) {
      if (!admin.password) return;
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(admin.password, salt);
    },
    async beforeUpdate(admin) {
      if (!admin.changed('password')) return;
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(admin.password, salt);
    },
  },
});

Admin.prototype.comparePassword = async function comparePassword(rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

module.exports = Admin;
