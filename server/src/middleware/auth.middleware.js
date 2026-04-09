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

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
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
