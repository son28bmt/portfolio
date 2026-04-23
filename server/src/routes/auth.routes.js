const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/auth.controller');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
});

// Đã tắt tính năng đăng ký tự do để bảo mật web
// router.post('/register', register);
router.post('/login', loginLimiter, login);

module.exports = router;
