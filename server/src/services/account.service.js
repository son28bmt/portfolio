const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { User, UserProfile, WalletAccount } = require('../models');
const { ensureMemberSchema } = require('./member-schema.service');

const sanitizeText = (value, max = 255) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  return clean.slice(0, max);
};

const sanitizeEmail = (value) => sanitizeText(value, 255).toLowerCase();

const sanitizePhone = (value) => sanitizeText(value, 40);

const sanitizeUsername = (value) =>
  sanitizeText(value, 60)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '');

const ensureUserProfile = async (userId, defaults = {}, transaction) => {
  const existing = await UserProfile.findByPk(userId, { transaction });
  if (existing) return existing;

  return UserProfile.create(
    {
      userId,
      fullName: sanitizeText(defaults.fullName, 160) || null,
      email: sanitizeEmail(defaults.email) || null,
      phone: sanitizePhone(defaults.phone) || null,
      tier: sanitizeText(defaults.tier, 40) || 'standard',
      registeredAt: defaults.registeredAt || new Date(),
    },
    { transaction },
  );
};

const ensureWalletAccount = async (userId, transaction) => {
  const existing = await WalletAccount.findOne({
    where: { userId },
    transaction,
  });
  if (existing) return existing;

  return WalletAccount.create(
    {
      userId,
      balance: 0,
      status: 'active',
    },
    { transaction },
  );
};

const serializeAccount = ({ user, profile, walletAccount }) => ({
  id: user.id,
  username: user.username,
  fullName: profile?.fullName || '',
  email: profile?.email || '',
  phone: profile?.phone || '',
  tier: profile?.tier || 'standard',
  registeredAt: profile?.registeredAt || user.createdAt,
  wallet: {
    id: walletAccount?.id || null,
    balance: Number(walletAccount?.balance || 0),
    status: walletAccount?.status || 'active',
  },
});

const getAccountBundle = async (userId, transaction) => {
  await ensureMemberSchema();

  const user = await User.findByPk(userId, { transaction });
  if (!user) {
    const error = new Error('Tài khoản không tồn tại.');
    error.status = 404;
    throw error;
  }

  const profile = await ensureUserProfile(
    user.id,
    { registeredAt: user.createdAt },
    transaction,
  );
  const walletAccount = await ensureWalletAccount(user.id, transaction);

  return { user, profile, walletAccount };
};

const registerUser = async ({ username, password, email, fullName }) => {
  await ensureMemberSchema();

  const cleanUsername = sanitizeUsername(username);
  const cleanEmail = sanitizeEmail(email);
  const cleanFullName = sanitizeText(fullName, 160);
  const cleanPassword = String(password || '');

  if (!cleanUsername || cleanUsername.length < 3) {
    const error = new Error('Username phải có ít nhất 3 ký tự hợp lệ.');
    error.status = 400;
    throw error;
  }

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const error = new Error('Email không hợp lệ.');
    error.status = 400;
    throw error;
  }

  if (cleanPassword.length < 6) {
    const error = new Error('Mật khẩu phải có ít nhất 6 ký tự.');
    error.status = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const userExists = await User.findOne({
      where: { username: cleanUsername },
      transaction,
    });
    if (userExists) {
      const error = new Error('Username đã tồn tại.');
      error.status = 409;
      throw error;
    }

    const emailExists = await UserProfile.findOne({
      where: { email: cleanEmail },
      transaction,
    });
    if (emailExists) {
      const error = new Error('Email đã được sử dụng.');
      error.status = 409;
      throw error;
    }

    const user = await User.create(
      {
        username: cleanUsername,
        password: cleanPassword,
      },
      { transaction },
    );

    const profile = await ensureUserProfile(
      user.id,
      {
        fullName: cleanFullName || cleanUsername,
        email: cleanEmail,
        registeredAt: user.createdAt,
      },
      transaction,
    );
    const walletAccount = await ensureWalletAccount(user.id, transaction);

    return serializeAccount({ user, profile, walletAccount });
  });
};

const getAccountMe = async (userId) => {
  const bundle = await getAccountBundle(userId);
  return serializeAccount(bundle);
};

const updateAccountMe = async (userId, payload = {}) => {
  await ensureMemberSchema();

  const cleanFullName =
    payload.fullName !== undefined ? sanitizeText(payload.fullName, 160) : undefined;
  const cleanEmail = payload.email !== undefined ? sanitizeEmail(payload.email) : undefined;
  const cleanPhone = payload.phone !== undefined ? sanitizePhone(payload.phone) : undefined;

  if (cleanEmail !== undefined && cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const error = new Error('Email không hợp lệ.');
    error.status = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const { user, profile, walletAccount } = await getAccountBundle(userId, transaction);

    if (cleanEmail !== undefined && cleanEmail) {
      const emailExists = await UserProfile.findOne({
        where: {
          email: cleanEmail,
          userId: { [Op.ne]: user.id },
        },
        transaction,
      });
      if (emailExists) {
        const error = new Error('Email đã được sử dụng.');
        error.status = 409;
        throw error;
      }
      profile.email = cleanEmail;
    }

    if (cleanFullName !== undefined) profile.fullName = cleanFullName || null;
    if (cleanPhone !== undefined) profile.phone = cleanPhone || null;

    await profile.save({ transaction });

    return serializeAccount({ user, profile, walletAccount });
  });
};

const changeAccountPassword = async (userId, currentPassword, newPassword) => {
  await ensureMemberSchema();

  const cleanCurrent = String(currentPassword || '');
  const cleanNext = String(newPassword || '');

  if (cleanNext.length < 6) {
    const error = new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    error.status = 400;
    throw error;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('Tài khoản không tồn tại.');
    error.status = 404;
    throw error;
  }

  const matched = await user.comparePassword(cleanCurrent);
  if (!matched) {
    const error = new Error('Mật khẩu hiện tại không đúng.');
    error.status = 400;
    throw error;
  }

  user.password = cleanNext;
  await user.save();
  return { message: 'Đã đổi mật khẩu thành công.' };
};

module.exports = {
  ensureUserProfile,
  ensureWalletAccount,
  getAccountBundle,
  registerUser,
  getAccountMe,
  updateAccountMe,
  changeAccountPassword,
};
