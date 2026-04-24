const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const {
  WalletAccount,
  WalletLedgerEntry,
  WalletTopup,
  User,
  UserProfile,
  Product,
  Order,
} = require('../models');
const {
  buildVietQrUrl,
  verifySepayWebhook,
  normalizeSepayPayload,
  toAmount,
} = require('./donate.service');
const { sendMarketplaceDeliveryEmail } = require('./email.service');
const { ensureMemberSchema } = require('./member-schema.service');
const { getAccountBundle } = require('./account.service');
const {
  FULFILLMENT_STATUSES,
  normalizeFulfillmentSource,
  buildProductSnapshot,
  buildSourceSnapshot,
  extractDeliveryText,
  normalizeOrderInput,
  getFulfillmentProvider,
} = require('./marketplace-fulfillment.service');
const { notifyAdmin } = require('./socket.service');

const TOPUP_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  FAILED: 'failed',
});

const sanitizeText = (value, max = 255) => {
  const clean = String(value || '').trim();
  return clean.slice(0, max);
};

const getWalletConfig = () => {
  const minAmount = toAmount(process.env.WALLET_MIN_AMOUNT) || 10000;
  const maxAmount = toAmount(process.env.WALLET_MAX_AMOUNT) || 20000000;
  const expireMinutes = toAmount(process.env.WALLET_TOPUP_EXPIRE_MINUTES) || 15;
  const bankBin = sanitizeText(process.env.WALLET_BANK_BIN || process.env.DONATE_BANK_BIN);
  const accountNo = sanitizeText(process.env.WALLET_ACCOUNT_NO || process.env.DONATE_ACCOUNT_NO);
  const accountName = sanitizeText(
    process.env.WALLET_ACCOUNT_NAME || process.env.DONATE_ACCOUNT_NAME,
  );

  return {
    minAmount: Math.max(1000, minAmount),
    maxAmount: Math.max(minAmount, maxAmount),
    expireMinutes: Math.max(1, expireMinutes),
    bankBin,
    accountNo,
    accountName,
    prefix: sanitizeText(process.env.WALLET_PAYMENT_PREFIX || 'WAL', 8).toUpperCase() || 'WAL',
  };
};

const generateWalletPaymentRef = (prefix = 'WAL') => {
  const ts = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}${ts}${random}`;
};

const getExpiresAt = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

const extractWalletPaymentRef = (text, prefix = 'WAL') => {
  const content = sanitizeText(text, 255).toUpperCase();
  const match = content.match(new RegExp(`${prefix}[A-Z0-9]{8,40}`));
  return match ? match[0] : '';
};

const serializeLedgerEntry = (row) => ({
  id: row.id,
  direction: row.direction,
  amount: Number(row.amount || 0),
  balanceBefore: Number(row.balanceBefore || 0),
  balanceAfter: Number(row.balanceAfter || 0),
  type: row.type,
  refType: row.refType,
  refId: row.refId,
  meta: row.meta || {},
  createdAt: row.createdAt,
});

const serializeTopup = (row) => ({
  id: row.id,
  amount: Number(row.amount || 0),
  paymentRef: row.paymentRef,
  provider: row.provider,
  status: row.status,
  providerTxnId: row.providerTxnId,
  expiresAt: row.expiresAt,
  paidAt: row.paidAt,
  createdAt: row.createdAt,
});

const createLedgerEntry = async ({
  walletAccount,
  direction,
  amount,
  type,
  refType,
  refId,
  idempotencyKey,
  meta = {},
  transaction,
}) => {
  const currentBalance = Number(walletAccount.balance || 0);
  const cleanAmount = Number(amount || 0);
  const nextBalance =
    direction === 'credit' ? currentBalance + cleanAmount : currentBalance - cleanAmount;

  if (cleanAmount <= 0) {
    const error = new Error('So tien giao dich khong hop le.');
    error.status = 400;
    throw error;
  }

  if (nextBalance < 0) {
    const error = new Error('So du khong du.');
    error.status = 409;
    throw error;
  }

  const ledgerEntry = await WalletLedgerEntry.create(
    {
      walletAccountId: walletAccount.id,
      direction,
      amount: cleanAmount,
      balanceBefore: currentBalance,
      balanceAfter: nextBalance,
      type,
      refType,
      refId,
      idempotencyKey,
      meta,
    },
    { transaction },
  );

  walletAccount.balance = nextBalance;
  await walletAccount.save({ transaction });

  return ledgerEntry;
};

const getWalletMe = async (userId) => {
  const bundle = await getAccountBundle(userId);
  return {
    wallet: {
      id: bundle.walletAccount.id,
      balance: Number(bundle.walletAccount.balance || 0),
      status: bundle.walletAccount.status,
    },
    profile: {
      fullName: bundle.profile.fullName || '',
      email: bundle.profile.email || '',
      phone: bundle.profile.phone || '',
      tier: bundle.profile.tier || 'standard',
      registeredAt: bundle.profile.registeredAt || bundle.user.createdAt,
    },
  };
};

const createWalletTopupIntent = async (userId, amount) => {
  await ensureMemberSchema();
  const config = getWalletConfig();
  const cleanAmount = toAmount(amount);

  if (!config.bankBin || !config.accountNo || !config.accountName) {
    const error = new Error('Thieu cau hinh tai khoan nhan tien cho vi noi bo.');
    error.status = 500;
    throw error;
  }

  if (!cleanAmount || cleanAmount < config.minAmount || cleanAmount > config.maxAmount) {
    const error = new Error(
      `So tien nap phai nam trong khoang ${config.minAmount} - ${config.maxAmount} VND.`,
    );
    error.status = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const { walletAccount } = await getAccountBundle(userId, transaction);
    if (walletAccount.status !== 'active') {
      const error = new Error('Vi hien dang bi khoa.');
      error.status = 403;
      throw error;
    }

    let paymentRef = '';
    for (let i = 0; i < 5; i += 1) {
      paymentRef = generateWalletPaymentRef(config.prefix);
      const exists = await WalletTopup.findOne({
        where: { paymentRef },
        attributes: ['id'],
        transaction,
      });
      if (!exists) break;
    }

    if (!paymentRef) {
      const error = new Error('Khong the tao ma nap quy. Vui long thu lai.');
      error.status = 500;
      throw error;
    }

    const topup = await WalletTopup.create(
      {
        walletAccountId: walletAccount.id,
        amount: cleanAmount,
        paymentRef,
        provider: 'sepay',
        status: TOPUP_STATUS.PENDING,
        expiresAt: getExpiresAt(config.expireMinutes),
      },
      { transaction },
    );

    const qrImageUrl = buildVietQrUrl({
      bankBin: config.bankBin,
      accountNo: config.accountNo,
      accountName: config.accountName,
      amount: cleanAmount,
      transferContent: paymentRef,
    });

    notifyAdmin('admin_wallet_refresh');

    return {
      topup: serializeTopup(topup),
      qrImageUrl,
      transferContent: paymentRef,
      bankBin: config.bankBin,
      accountNo: config.accountNo,
      accountName: config.accountName,
    };
  });
};

const getWalletTopupStatus = async (userId, topupId) => {
  await ensureMemberSchema();

  const { walletAccount } = await getAccountBundle(userId);
  const topup = await WalletTopup.findOne({
    where: {
      id: topupId,
      walletAccountId: walletAccount.id,
    },
  });

  if (!topup) {
    const error = new Error('Khong tim thay lenh nap quy.');
    error.status = 404;
    throw error;
  }

  if (topup.status === TOPUP_STATUS.PENDING && topup.expiresAt && topup.expiresAt <= new Date()) {
    topup.status = TOPUP_STATUS.EXPIRED;
    await topup.save();
  }

  return serializeTopup(topup);
};

const listWalletLedger = async (userId, { limit = 20, cursor } = {}) => {
  await ensureMemberSchema();
  const { walletAccount } = await getAccountBundle(userId);
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const where = { walletAccountId: walletAccount.id };
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      where.createdAt = { [Op.lt]: cursorDate };
    }
  }

  const rows = await WalletLedgerEntry.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: cleanLimit,
  });

  const items = rows.map(serializeLedgerEntry);
  const nextCursor = items.length === cleanLimit ? items[items.length - 1].createdAt : null;

  return {
    items,
    nextCursor,
  };
};

const listWalletPurchases = async (userId, { limit = 20, page = 1 } = {}) => {
  await ensureMemberSchema();
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const cleanPage = Math.max(1, Number(page) || 1);

  const result = await Order.findAndCountAll({
    where: {
      userId,
      paymentMethod: 'wallet',
    },
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'price'] }],
    order: [['createdAt', 'DESC']],
    offset: (cleanPage - 1) * cleanLimit,
    limit: cleanLimit,
  });

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      amount: Number(row.amount || 0),
      status: row.status,
      fulfillmentStatus: row.fulfillmentStatus,
      paymentMethod: row.paymentMethod,
      product: row.product
        ? {
            id: row.product.id,
            name: row.product.name,
            price: Number(row.product.price || 0),
          }
        : null,
      createdAt: row.createdAt,
      paidAt: row.paid_at,
    })),
    total: result.count,
    page: cleanPage,
    totalPages: Math.max(1, Math.ceil(result.count / cleanLimit)),
  };
};

const walletCheckout = async (userId, { productId, orderInput = {} }) => {
  await ensureMemberSchema();
  const cleanProductId = Number(productId || 0);
  if (!Number.isInteger(cleanProductId) || cleanProductId <= 0) {
    const error = new Error('productId khong hop le.');
    error.status = 400;
    throw error;
  }

  let emailToDeliver = '';
  let deliveryText = '';
  let createdOrder = null;
  let productName = '';

  const result = await sequelize.transaction(async (transaction) => {
    const { walletAccount, profile } = await getAccountBundle(userId, transaction);
    if (walletAccount.status !== 'active') {
      const error = new Error('Vi hien dang bi khoa.');
      error.status = 403;
      throw error;
    }

    const email = sanitizeText(profile.email, 255).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const error = new Error('Ban can cap nhat email hop le truoc khi mua bang quy.');
      error.status = 400;
      throw error;
    }

    const lockedWallet = await WalletAccount.findByPk(walletAccount.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const product = await Product.findByPk(cleanProductId, { transaction });
    if (!product) {
      const error = new Error('San pham khong ton tai.');
      error.status = 404;
      throw error;
    }

    const sourceType = normalizeFulfillmentSource(product.sourceType);
    const provider = getFulfillmentProvider(sourceType);
    await provider.assertProductReady({ product });
    const preparedOrder = await provider.prepareOrderIntent({
      product,
      orderInput: normalizeOrderInput(orderInput),
    });
    const amount = toAmount(preparedOrder?.amount);
    if (!amount || amount <= 0) {
      const error = new Error('San pham chua co gia hop le.');
      error.status = 400;
      throw error;
    }

    if (Number(lockedWallet.balance || 0) < amount) {
      const error = new Error('So du quy khong du de thanh toan.');
      error.status = 409;
      throw error;
    }

    let internalPaymentRef = '';
    for (let i = 0; i < 5; i += 1) {
      internalPaymentRef = generateWalletPaymentRef('WPO');
      const existingOrder = await Order.findOne({
        where: { payment_ref: internalPaymentRef },
        attributes: ['id'],
        transaction,
      });
      if (!existingOrder) break;
    }
    if (!internalPaymentRef) {
      const error = new Error('Khong the tao ma giao dich noi bo. Vui long thu lai.');
      error.status = 500;
      throw error;
    }
    const order = await Order.create(
      {
        userId,
        email,
        productId: product.id,
        status: 'pending',
        paymentMethod: 'wallet',
        fulfillmentStatus: FULFILLMENT_STATUSES.PENDING,
        fulfillmentSource: sourceType,
        fulfillmentPayload: preparedOrder?.requestInput
          ? {
              requestInput: preparedOrder.requestInput,
              lifecycle: 'wallet_checkout',
            }
          : null,
        productSnapshot: buildProductSnapshot(product),
        sourceSnapshot: buildSourceSnapshot(product),
        payment_ref: internalPaymentRef,
        amount,
      },
      { transaction },
    );

    const fulfillment = await provider.fulfillPaidOrder({ order, transaction });
    if (!fulfillment?.ok) {
      const error = new Error(fulfillment?.message || 'Khong the giao hang.');
      error.status = fulfillment?.code === 'out_of_stock' ? 409 : 500;
      throw error;
    }

    const ledgerEntry = await createLedgerEntry({
      walletAccount: lockedWallet,
      direction: 'debit',
      amount,
      type: 'purchase',
      refType: 'order',
      refId: String(order.id),
      idempotencyKey: `wallet_purchase:${order.id}`,
      meta: {
        productId: product.id,
        productName: product.name,
      },
      transaction,
    });

    order.status = 'paid';
    order.walletLedgerEntryId = ledgerEntry.id;
    order.fulfillmentStatus =
      fulfillment.fulfillmentStatus || FULFILLMENT_STATUSES.DELIVERED;
    order.stockItemId = fulfillment.stockItemId || null;
    order.fulfillmentPayload = fulfillment.deliveryPayload || order.fulfillmentPayload || null;
    order.paid_at = new Date();
    await order.save({ transaction });

    emailToDeliver = email;
    deliveryText = extractDeliveryText(fulfillment.deliveryPayload);
    createdOrder = order;
    productName = product.name;

    return {
      orderId: order.id,
      paymentRef: order.payment_ref,
      balanceAfter: Number(lockedWallet.balance || 0),
      deliveryText,
      productName: product.name,
      fulfillmentStatus: order.fulfillmentStatus,
    };
  });

  if (createdOrder && deliveryText) {
    try {
      await sendMarketplaceDeliveryEmail({
        to: emailToDeliver,
        productName: result.productName,
        productData: deliveryText,
        orderId: createdOrder.id,
      });
    } catch (error) {
      console.error('[Wallet] Gui email giao hang that bai:', error.message);
    }
  }

  notifyAdmin('admin_wallet_refresh');
  notifyAdmin('admin_market_refresh');

  return {
    message: 'Thanh toan bang quy thanh cong.',
    orderId: result.orderId,
    paymentRef: result.paymentRef,
    balanceAfter: result.balanceAfter,
    fulfillmentStatus: result.fulfillmentStatus,
    deliveryText: result.deliveryText || '',
    productName,
  };
};

const processWalletWebhook = async (req) => {
  await ensureMemberSchema();

  const verification = verifySepayWebhook(req);
  if (!verification.ok) {
    const error = new Error('Webhook SePay khong hop le.');
    error.status = 401;
    throw error;
  }

  const payload = normalizeSepayPayload(req.body);
  if (!payload.isSuccess) {
    return { ok: true, type: 'ignored', message: 'Bo qua webhook khong phai giao dich thanh cong.' };
  }

  const prefix = getWalletConfig().prefix;
  const paymentRef = extractWalletPaymentRef(payload.transferContent, prefix);
  if (!paymentRef) {
    return { ok: true, type: 'ignored', message: 'Khong tim thay paymentRef cua vi noi bo.' };
  }

  const result = await sequelize.transaction(async (transaction) => {
    const topup = await WalletTopup.findOne({
      where: { paymentRef },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!topup) {
      return { ok: true, type: 'not_found', message: 'Khong tim thay lenh nap quy.' };
    }

    if (topup.status === TOPUP_STATUS.PAID) {
      return { ok: true, type: 'already_paid', topup: serializeTopup(topup) };
    }

    if (topup.expiresAt && new Date(topup.expiresAt).getTime() <= Date.now()) {
      topup.status = TOPUP_STATUS.EXPIRED;
      topup.rawWebhook = JSON.stringify(payload.rawPayload);
      await topup.save({ transaction });
      return { ok: true, type: 'expired', topup: serializeTopup(topup) };
    }

    if (!payload.amount || Number(payload.amount) !== Number(topup.amount)) {
      topup.status = TOPUP_STATUS.FAILED;
      topup.rawWebhook = JSON.stringify(payload.rawPayload);
      await topup.save({ transaction });
      return {
        ok: true,
        type: 'amount_mismatch',
        topup: serializeTopup(topup),
      };
    }

    if (payload.providerTxnId) {
      const existingByTxn = await WalletTopup.findOne({
        where: {
          providerTxnId: payload.providerTxnId,
          id: { [Op.ne]: topup.id },
        },
        transaction,
      });
      if (existingByTxn) {
        return { ok: true, type: 'duplicate', topup: serializeTopup(existingByTxn) };
      }
    }

    const walletAccount = await WalletAccount.findByPk(topup.walletAccountId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!walletAccount) {
      const error = new Error('Khong tim thay vi noi bo.');
      error.status = 404;
      throw error;
    }

    await createLedgerEntry({
      walletAccount,
      direction: 'credit',
      amount: Number(topup.amount),
      type: 'topup',
      refType: 'wallet_topup',
      refId: topup.id,
      idempotencyKey: `wallet_topup:${topup.id}:${payload.providerTxnId || paymentRef}`,
      meta: {
        paymentRef,
        providerTxnId: payload.providerTxnId || null,
      },
      transaction,
    });

    topup.status = TOPUP_STATUS.PAID;
    topup.providerTxnId = payload.providerTxnId || topup.providerTxnId;
    topup.paidAt = new Date();
    topup.rawWebhook = JSON.stringify(payload.rawPayload);
    await topup.save({ transaction });

    return { ok: true, type: 'paid', topup: serializeTopup(topup) };
  });

  notifyAdmin('admin_wallet_refresh');
  return result;
};

const getAdminWalletUsers = async ({ page = 1, limit = 20, q = '' } = {}) => {
  await ensureMemberSchema();
  const cleanPage = Math.max(1, Number(page) || 1);
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const cleanQ = sanitizeText(q, 120).toLowerCase();

  const include = [
    { model: UserProfile, as: 'profile', required: false },
    { model: WalletAccount, as: 'walletAccount', required: false },
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
    items: result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      fullName: row.profile?.fullName || '',
      email: row.profile?.email || '',
      tier: row.profile?.tier || 'standard',
      walletBalance: Number(row.walletAccount?.balance || 0),
      walletStatus: row.walletAccount?.status || 'active',
      createdAt: row.createdAt,
    })),
    total: result.count,
    page: cleanPage,
    totalPages: Math.max(1, Math.ceil(result.count / cleanLimit)),
  };
};

const getAdminWalletTopups = async ({ page = 1, limit = 20, status = '' } = {}) => {
  await ensureMemberSchema();
  const cleanPage = Math.max(1, Number(page) || 1);
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const where = {};
  if (status) where.status = status;

  const result = await WalletTopup.findAndCountAll({
    where,
    include: [
      {
        model: WalletAccount,
        as: 'walletAccount',
        include: [
          {
            model: User,
            as: 'user',
            required: false,
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    offset: (cleanPage - 1) * cleanLimit,
    limit: cleanLimit,
  });

  return {
    items: result.rows.map((row) => ({
      ...serializeTopup(row),
      walletAccountId: row.walletAccountId,
      username: row.walletAccount?.user?.username || '',
    })),
    total: result.count,
    page: cleanPage,
    totalPages: Math.max(1, Math.ceil(result.count / cleanLimit)),
  };
};

const getAdminWalletLedger = async ({ page = 1, limit = 20, type = '' } = {}) => {
  await ensureMemberSchema();
  const cleanPage = Math.max(1, Number(page) || 1);
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const where = {};
  if (type) where.type = type;

  const result = await WalletLedgerEntry.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    offset: (cleanPage - 1) * cleanLimit,
    limit: cleanLimit,
  });

  return {
    items: result.rows.map(serializeLedgerEntry),
    total: result.count,
    page: cleanPage,
    totalPages: Math.max(1, Math.ceil(result.count / cleanLimit)),
  };
};

module.exports = {
  getWalletMe,
  createWalletTopupIntent,
  getWalletTopupStatus,
  listWalletLedger,
  listWalletPurchases,
  walletCheckout,
  processWalletWebhook,
  getAdminWalletUsers,
  getAdminWalletTopups,
  getAdminWalletLedger,
};
