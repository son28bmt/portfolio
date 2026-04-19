const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      if (!token) {
        throw new Error('No token provided after Bearer');
      }

      if (!process.env.JWT_SECRET) {
        console.error('❌ Critical Error: JWT_SECRET is not defined in environment.');
        return res.status(500).json({ message: 'Lỗi cấu hình hệ thống. Vui lòng liên hệ quản trị viên.' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Support both User (Portfolio) and Admin (Marketplace)
      if (decoded.adminId) {
        const { Admin } = require('../models');
        const admin = await Admin.findByPk(decoded.adminId);
        if (!admin) throw new Error('Admin not found');
        req.user = { id: admin.id, username: admin.username, isAdmin: true };
        return next();
      }

      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        return res.status(401).json({ message: 'Tài khoản không tồn tại trên hệ thống.' });
      }
      
      return next();
    } catch (error) {
      console.error('❌ Auth Middleware Error:', error.message);
      return res.status(401).json({ message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập lại.' });
  }
};

module.exports = { protect };
