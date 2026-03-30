const jwt = require('jsonwebtoken');
const { Admin, User } = require('../models');

const protectMarketplaceAdmin = async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập admin.' });
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (!decoded?.adminId && !decoded?.id) {
      return res.status(401).json({ message: 'Token không hợp lệ.' });
    }

    // Ưu tiên token mới của bảng admins
    if (decoded.adminId) {
      const admin = await Admin.findByPk(decoded.adminId);
      if (!admin) {
        return res.status(401).json({ message: 'Tài khoản admin không tồn tại.' });
      }
      req.marketplaceAdmin = { id: admin.id, username: admin.username, source: 'admins' };
      return next();
    }

    // Tương thích ngược token từ bảng User (hệ thống admin cũ)
    const legacyUser = await User.findByPk(decoded.id);
    if (!legacyUser) {
      return res.status(401).json({ message: 'Tài khoản quản trị không tồn tại.' });
    }

    req.marketplaceAdmin = { id: legacyUser.id, username: legacyUser.username, source: 'users' };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Phiên đăng nhập admin đã hết hạn hoặc không hợp lệ.' });
  }
};

module.exports = { protectMarketplaceAdmin };
