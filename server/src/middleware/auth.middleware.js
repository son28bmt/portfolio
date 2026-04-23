const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getJwtSecret } = require("../utils/jwt.util");

const resolveAdminUsernames = () => {
  const raw = String(process.env.ADMIN_USERNAMES || "admin");
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      if (!token) throw new Error("No token provided after Bearer");

      const decoded = jwt.verify(token, getJwtSecret());

      // Hỗ trợ cả token của marketplace admin.
      if (decoded.adminId) {
        const { Admin } = require("../models");
        const admin = await Admin.findByPk(decoded.adminId);
        if (!admin) throw new Error("Admin not found");

        req.user = { id: admin.id, username: admin.username, isAdmin: true };
        return next();
      }

      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });

      if (!req.user) {
        return res.status(401).json({
          message: "Tài khoản không tồn tại trên hệ thống.",
        });
      }

      const adminUsernames = resolveAdminUsernames();
      const username = String(req.user.username || "").trim().toLowerCase();
      req.user.isAdmin = adminUsernames.includes(username);
      return next();
    } catch (error) {
      const status = /JWT_SECRET/.test(String(error?.message || "")) ? 500 : 401;
      return res.status(status).json({
        message:
          status === 500
            ? "Máy chủ thiếu cấu hình bảo mật JWT_SECRET."
            : "Phiên đăng nhập hết hạn hoặc không hợp lệ.",
      });
    }
  }

  return res.status(401).json({
    message: "Bạn chưa đăng nhập. Vui lòng đăng nhập lại.",
  });
};

module.exports = { protect };
