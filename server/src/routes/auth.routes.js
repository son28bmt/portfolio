const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/auth.controller');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message: 'Ban da thu dang nhap qua nhieu lan. Vui long thu lai sau 15 phut.',
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: {
    message: 'Ban da dang ky qua nhieu lan. Vui long thu lai sau 1 gio.',
  },
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);

module.exports = router;
