const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({
      message: 'Chỉ Owner mới có quyền thực hiện thao tác này.',
    });
  }

  return next();
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      message: 'Bạn không có quyền thực hiện thao tác này.',
    });
  }

  return next();
};

module.exports = { requireAdmin, requireRoles };
