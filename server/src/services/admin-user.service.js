const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const {
  User,
  UserProfile,
  WalletAccount,
  WalletLedgerEntry,
  WalletTopup,
  Order,
} = require('../models');
const { ensureMemberSchema } = require('./member-schema.service');
const {
  ensureUserProfile,
  ensureWalletAccount,
} = require('./account.service');

const sanitizeText = (value, max = 255) =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

const sanitizeEmail = (value) => sanitizeText(value, 255).toLowerCase();

const toPositiveInt = (value, fallback = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.floor(number));
};

const serializeUser = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.profile?.fullName || '',
  email: user.profile?.email || '',
  phone: user.profile?.phone || '',
  tier: user.profile?.tier || 'standard',
  registeredAt: user.profile?.registeredAt || user.createdAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  wallet: {
    id: user.walletAccount?.id || null,
    balance: Number(user.walletAccount?.balance || 0),
    status: user.walletAccount?.status || 'active',
  },
});

const loadUserBundle = async (userId, transaction) => {
  await ensureMemberSchema();

  const user = await User.findByPk(userId, {
    include: [
      { model: UserProfile, as: 'profile', required: false },
      { model: WalletAccount, as: 'walletAccount', required: false },
    ],
    transaction,
  });

  if (!user) {
    const error = new Error('Không tìm thấy người dùng.');
    error.status = 404;
    throw error;
  }

  const profile = user.profile || await ensureUserProfile(user.id, { registeredAt: user.createdAt }, transaction);
  const walletAccount = user.walletAccount || await ensureWalletAccount(user.id, transaction);

  user.setDataValue('profile', profile);
  user.setDataValue('walletAccount', walletAccount);
  return user;
};

const listAdminUsers = async ({
  page = 1,
  limit = 20,
  q = '',
  tier = '',
  walletStatus = '',
} = {}) => {
  await ensureMemberSchema();

  const cleanPage = toPositiveInt(page, 1);
  const cleanLimit = Math.min(100, toPositiveInt(limit, 20));
  const cleanQ = sanitizeText(q, 120).toLowerCase();
  const cleanTier = sanitizeText(tier, 40).toLowerCase();
  const cleanWalletStatus = sanitizeText(walletStatus, 20).toLowerCase();

  const include = [
    {
      model: UserProfile,
      as: 'profile',
      required: Boolean(cleanTier),
      where: cleanTier ? { tier: cleanTier } : undefined,
    },
    {
      model: WalletAccount,
      as: 'walletAccount',
      required: Boolean(cleanWalletStatus),
      where: cleanWalletStatus ? { status: cleanWalletStatus } : undefined,
    },
  ];

  const where = {};
  if (cleanQ) {
    where[Op.or] = [
      sequelize.where(sequelize.fn('LOWER', sequelize.col('User.username')), {
        [Op.like]: `%${cleanQ}%`,
      }),
      sequelize.where(sequelize.fn('LOWER', sequelize.col('profile.email')), {
        [Op.like]: `%${cleanQ}%`,
      }),
      sequelize.where(sequelize.fn('LOWER', sequelize.col('profile.fullName')), {
        [Op.like]: `%${cleanQ}%`,
      }),
    ];
  }

  const result = await User.findAndCountAll({
    where,
    include,
    order: [['createdAt', 'DESC']],
    distinct: true,
    offset: (cleanPage - 1) * cleanLimit,
    limit: cleanLimit,
  });

  return {
    items: result.rows.map(serializeUser),
    total: result.count,
    page: cleanPage,
    totalPages: Math.max(1, Math.ceil(result.count / cleanLimit)),
  };
};

const getAdminUserDetail = async (userId) => {
  const user = await loadUserBundle(userId);
  const walletAccountId = user.walletAccount?.id;

  const [orders, topups, ledger] = await Promise.all([
    Order.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    walletAccountId
      ? WalletTopup.findAll({
          where: { walletAccountId },
          order: [['createdAt', 'DESC']],
          limit: 10,
        })
      : [],
    walletAccountId
      ? WalletLedgerEntry.findAll({
          where: { walletAccountId },
          order: [['createdAt', 'DESC']],
          limit: 20,
        })
      : [],
  ]);

  return {
    user: serializeUser(user),
    orders: orders.map((order) => ({
      id: order.id,
      paymentRef: order.payment_ref,
      status: order.status,
      paymentMethod: order.paymentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      amount: Number(order.amount || 0),
      createdAt: order.createdAt,
      paidAt: order.paid_at,
    })),
    topups: topups.map((topup) => ({
      id: topup.id,
      amount: Number(topup.amount || 0),
      paymentRef: topup.paymentRef,
      status: topup.status,
      paidAt: topup.paidAt,
      expiresAt: topup.expiresAt,
      createdAt: topup.createdAt,
    })),
    ledger: ledger.map((entry) => ({
      id: entry.id,
      direction: entry.direction,
      amount: Number(entry.amount || 0),
      balanceBefore: Number(entry.balanceBefore || 0),
      balanceAfter: Number(entry.balanceAfter || 0),
      type: entry.type,
      refType: entry.refType,
      refId: entry.refId,
      createdAt: entry.createdAt,
    })),
  };
};

const updateAdminUserProfile = async (userId, payload = {}) => {
  await ensureMemberSchema();

  const cleanFullName =
    payload.fullName !== undefined ? sanitizeText(payload.fullName, 160) : undefined;
  const cleanEmail = payload.email !== undefined ? sanitizeEmail(payload.email) : undefined;
  const cleanPhone = payload.phone !== undefined ? sanitizeText(payload.phone, 40) : undefined;
  const cleanTier = payload.tier !== undefined ? sanitizeText(payload.tier, 40).toLowerCase() : undefined;

  if (cleanEmail !== undefined && cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const error = new Error('Email không hợp lệ.');
    error.status = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const user = await loadUserBundle(userId, transaction);
    const profile = user.profile;

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
    if (cleanEmail !== undefined && !cleanEmail) profile.email = null;
    if (cleanPhone !== undefined) profile.phone = cleanPhone || null;
    if (cleanTier !== undefined) profile.tier = cleanTier || 'standard';

    await profile.save({ transaction });
    return serializeUser(user);
  });
};

const updateAdminUserWalletStatus = async (userId, status) => {
  const cleanStatus = sanitizeText(status, 20).toLowerCase();
  if (!['active', 'locked'].includes(cleanStatus)) {
    const error = new Error('Trạng thái ví không hợp lệ.');
    error.status = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const user = await loadUserBundle(userId, transaction);
    user.walletAccount.status = cleanStatus;
    await user.walletAccount.save({ transaction });
    return serializeUser(user);
  });
};

const resetAdminUserPassword = async (userId, password) => {
  const cleanPassword = String(password || '');
  if (cleanPassword.length < 6) {
    const error = new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    error.status = 400;
    throw error;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('Không tìm thấy người dùng.');
    error.status = 404;
    throw error;
  }

  user.password = cleanPassword;
  await user.save();
  return { message: 'Đã đặt lại mật khẩu người dùng.' };
};

module.exports = {
  listAdminUsers,
  getAdminUserDetail,
  updateAdminUserProfile,
  updateAdminUserWalletStatus,
  resetAdminUserPassword,
};
