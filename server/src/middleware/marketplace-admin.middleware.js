const jwt = require("jsonwebtoken");
const { Admin } = require("../models");

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
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
    return res
      .status(401)
      .json({ message: "Phien dang nhap admin het han hoac khong hop le." });
  }
};

module.exports = { protectMarketplaceAdmin };
