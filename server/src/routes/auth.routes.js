const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/auth.controller');
const { verifyTurnstile } = require('../middleware/turnstile.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau 1 giờ.',
  },
});

router.post('/register', registerLimiter, verifyTurnstile, register);
router.post('/login', loginLimiter, login);

module.exports = router;
