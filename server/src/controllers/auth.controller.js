const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwt.util');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const userExists = await User.findOne({ where: { username } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ username, password });
    
    res.status(201).json({
      id: user.id,
      username: user.username,
      token: generateToken(user.id),
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
    const { username, password } = req.body;

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
