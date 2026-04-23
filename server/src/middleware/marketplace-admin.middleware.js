const jwt = require("jsonwebtoken");
const { Admin } = require("../models");
const { getJwtSecret } = require("../utils/jwt.util");

const protectMarketplaceAdmin = async (req, res, next) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Ban chua dang nhap admin." });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: "Thieu token admin." });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded?.adminId) {
      return res.status(401).json({ message: "Token admin khong hop le." });
    }

    const admin = await Admin.findByPk(decoded.adminId);
    if (!admin) {
      return res.status(401).json({ message: "Tai khoan admin khong ton tai." });
    }

    req.marketplaceAdmin = {
      id: admin.id,
      username: admin.username,
      source: "admins",
    };
    return next();
  } catch (error) {
    const status = /JWT_SECRET/.test(String(error?.message || "")) ? 500 : 401;
    return res
      .status(status)
      .json({
        message:
          status === 500
            ? "Máy chủ thiếu cấu hình bảo mật JWT_SECRET."
            : "Phien dang nhap admin het han hoac khong hop le.",
      });
  }
};

module.exports = { protectMarketplaceAdmin };
