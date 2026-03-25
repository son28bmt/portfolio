const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/auth.controller');

// Đã tắt tính năng đăng ký tự do để bảo mật web
// router.post('/register', register);
router.post('/login', login);

module.exports = router;
