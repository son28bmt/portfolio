const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwt.util');
const { getAccountMe, registerUser } = require('../services/account.service');
const { notifyTelegramAuthEvent } = require('../services/telegram.service');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

exports.register = async (req, res) => {
  try {
    const honeypot = String(req.body?.website || req.body?.company || '').trim();
    if (honeypot) {
      return res.status(400).json({ message: 'Yêu cầu đăng ký không hợp lệ.' });
    }

    const { username, password, email, fullName } = req.body || {};
    const account = await registerUser({ username, password, email, fullName });
    const token = generateToken(account.id);

    notifyTelegramAuthEvent({ event: 'register', account, req });

    res.status(201).json({
      id: account.id,
      username: account.username,
      token,
      account,
    });
  } catch (error) {
    const isSecretError = /JWT_SECRET/.test(String(error?.message || ''));
    const status = isSecretError ? 500 : error.status || 500;
    res.status(status).json({
      message: isSecretError
        ? 'Máy chủ thiếu cấu hình bảo mật JWT_SECRET.'
        : error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await User.findOne({ where: { username } });
    if (user && (await user.comparePassword(password))) {
      const token = generateToken(user.id);

      res.json({
        id: user.id,
        username: user.username,
        token,
      });

      getAccountMe(user.id)
        .then((account) => notifyTelegramAuthEvent({ event: 'login', account, req }))
        .catch(() => notifyTelegramAuthEvent({ event: 'login', account: user, req }));
    } else {
      res.status(401).json({ message: 'Username hoặc mật khẩu không đúng.' });
    }
  } catch (error) {
    const isSecretError = /JWT_SECRET/.test(String(error?.message || ''));
    const status = isSecretError ? 500 : error.status || 500;
    res.status(status).json({
      message: isSecretError
        ? 'Máy chủ thiếu cấu hình bảo mật JWT_SECRET.'
        : error.message,
    });
  }
};
