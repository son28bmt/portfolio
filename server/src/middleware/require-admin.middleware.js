const resolveAdminUsernames = () => {
  const raw = String(process.env.ADMIN_USERNAMES || "admin");
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const requireAdmin = (req, res, next) => {
  const username = String(req.user?.username || "").trim().toLowerCase();
  const isAdminUsername = resolveAdminUsernames().includes(username);
  const isAdmin = Boolean(req.user?.isAdmin || isAdminUsername);

  if (!req.user || !isAdmin) {
    return res.status(403).json({
      message: "Bạn không có quyền quản trị để thực hiện hành động này.",
    });
  }

  return next();
};

module.exports = { requireAdmin };
