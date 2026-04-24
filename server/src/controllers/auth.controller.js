const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwt.util');
const { registerUser } = require('../services/account.service');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

exports.register = async (req, res) => {
  try {
    const { username, password, email, fullName } = req.body || {};
    const account = await registerUser({ username, password, email, fullName });

    res.status(201).json({
      id: account.id,
      username: account.username,
      token: generateToken(account.id),
      account,
    });
  } catch (error) {
    const isSecretError = /JWT_SECRET/.test(String(error?.message || ''));
    res.status(500).json({
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
      res.json({
        id: user.id,
        username: user.username,
        token: generateToken(user.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    const isSecretError = /JWT_SECRET/.test(String(error?.message || ''));
    res.status(500).json({
      message: isSecretError
        ? 'Máy chủ thiếu cấu hình bảo mật JWT_SECRET.'
        : error.message,
    });
  }
};
