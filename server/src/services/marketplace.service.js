const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { Product, Order, StockItem, Category } = require('../models');
const { buildVietQrUrl, verifySepayWebhook, normalizeSepayPayload } = require('./donate.service');
const { sendMarketplaceDeliveryEmail } = require('./email.service');
const { sendEvent } = require('./sse.service');
const { notifyAdmin } = require('./socket.service');
const {
  notifyTelegramOrderCreated,
  notifyTelegramOrderStatus,
} = require('./telegram.service');
const { ensureMarketplaceSchema } = require('./marketplace-schema.service');
const { applySupplierStatusRefresh } = require('./marketplace-supplier-sync.service');
const {
  FULFILLMENT_STATUSES,
  normalizeFulfillmentSource,
  normalizeSourceConfig,
  buildProductSnapshot,
  buildSourceSnapshot,
  extractDeliveryText,
  normalizeOrderInput,
  getFulfillmentProvider,
} = require('./marketplace-fulfillment.service');

const raise = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const toInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const toAmount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const randomCode = (size = 6) =>
  crypto.randomBytes(Math.ceil(size / 2)).toString('hex').toUpperCase().slice(0, size);

const generatePaymentRef = () => `ORD${Date.now().toString(36).toUpperCase()}${randomCode(6)}`;

const getPaymentConfig = () => {
  const bankBin = String(process.env.MARKET_BANK_BIN || process.env.DONATE_BANK_BIN || '').trim();
  const accountNo = String(process.env.MARKET_ACCOUNT_NO || process.env.DONATE_ACCOUNT_NO || '').trim();
  const accountName = String(process.env.MARKET_ACCOUNT_NAME || process.env.DONATE_ACCOUNT_NAME || '').trim();
  return { bankBin, accountNo, accountName };
};

const webhookLogPath = () => {
  const configured = String(process.env.MARKET_WEBHOOK_LOG_PATH || '').trim();
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, '../../logs/webhook-sepay.log');
};

const maskSecret = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length <= 8) return '*'.repeat(raw.length);
  return `${raw.slice(0, 4)}***${raw.slice(-2)}`;
};

const logWebhookRequest = async (req) => {
  try {
    const logPath = webhookLogPath();
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const logLine = JSON.stringify({
      time: new Date().toISOString(),
      ip: req.ip,
      headers: {
        authorization_masked: maskSecret(req.headers?.authorization || ''),
        'x-secret-key_masked': maskSecret(req.headers?.['x-secret-key'] || ''),
        'x-sepay-signature_masked': maskSecret(req.headers?.['x-sepay-signature'] || ''),
      },
      body: req.body || {},
    });

    await fs.promises.appendFile(logPath, `${logLine}\n`, 'utf8');
  } catch (error) {
    console.error('[Marketplace] Khong ghi duoc log webhook:', error.message);
  }
};

const extractPaymentRef = (text) => {
  const raw = String(text || '').trim().toUpperCase();
  if (!raw) return '';
  const match = raw.match(/ORD[A-Z0-9]{8,40}/);
  if (match) return match[0];
  return '';
};

const normalizeProductRecord = (product) => {
  const plain = product?.toJSON ? product.toJSON() : product;
  if (!plain) return plain;
  return {
    ...plain,
    sourceType: normalizeFulfillmentSource(plain.sourceType),
    sourceConfig: normalizeSourceConfig(plain.sourceConfig),
  };
};

const normalizeOrderRecord = (order) => {
  const plain = order?.toJSON ? order.toJSON() : order;
  if (!plain) return plain;
  const normalizedFulfillmentPayload = normalizeSourceConfig(plain.fulfillmentPayload);
  const normalizedProductSnapshot = normalizeSourceConfig(plain.productSnapshot);
  const normalizedSourceSnapshot = normalizeSourceConfig(plain.sourceSnapshot);
  return {
    ...plain,
    fulfillmentSource: normalizeFulfillmentSource(
      plain.fulfillmentSource || plain.product?.sourceType,
    ),
    fulfillmentStatus:
      String(plain.fulfillmentStatus || '').trim() ||
      (plain.status === 'paid' ? FULFILLMENT_STATUSES.DELIVERED : FULFILLMENT_STATUSES.PENDING),
    fulfillmentPayload:
      normalizedFulfillmentPayload &&
      Object.keys(normalizedFulfillmentPayload).length > 0
        ? normalizedFulfillmentPayload
        : null,
    productSnapshot:
      normalizedProductSnapshot &&
      Object.keys(normalizedProductSnapshot).length > 0
        ? normalizedProductSnapshot
        : null,
    sourceSnapshot:
      normalizedSourceSnapshot &&
      Object.keys(normalizedSourceSnapshot).length > 0
        ? normalizedSourceSnapshot
        : null,
    product: plain.product ? normalizeProductRecord(plain.product) : plain.product,
  };
};

const listPublicProducts = async () => {
  await ensureMarketplaceSchema();
  const rows = await Product.findAll({
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    attributes: [
      'id',
      'name',
      'description',
      'price',
      'quantity',
      'createdAt',
      'categoryId',
      'sourceType',
      'sourceConfig',
    ],
    order: [['id', 'DESC']],
  });
  return rows.map(normalizeProductRecord);
};

const createOrderIntent = async ({ email, productId, orderInput = {} }) => {
  await ensureMarketplaceSchema();

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanProductId = toInt(productId);

  if (!isEmail(cleanEmail)) {
    raise(400, 'Email khong hop le.');
  }
  if (!cleanProductId || cleanProductId <= 0) {
    raise(400, 'product_id khong hop le.');
  }

  const product = await Product.findByPk(cleanProductId);
  if (!product) {
    raise(404, 'San pham khong ton tai.');
  }

  const sourceType = normalizeFulfillmentSource(product.sourceType);
  const provider = getFulfillmentProvider(sourceType);
  await provider.assertProductReady({ product });
  const preparedOrder = await provider.prepareOrderIntent({
    product,
    orderInput: normalizeOrderInput(orderInput),
  });
  const amount = toAmount(preparedOrder?.amount);
  if (!amount || amount <= 0) raise(400, 'San pham chua co gia hop le.');

  const { bankBin, accountNo, accountName } = getPaymentConfig();
  if (!bankBin || !accountNo || !accountName) {
    raise(500, 'Thieu cau hinh tai khoan nhan tien cho SePay/VietQR.');
  }

  let paymentRef = '';
  for (let i = 0; i < 5; i += 1) {
    paymentRef = generatePaymentRef();
    const existed = await Order.findOne({ where: { payment_ref: paymentRef }, attributes: ['id'] });
    if (!existed) break;
  }
  if (!paymentRef) {
    raise(500, 'Khong the tao ma thanh toan, vui long thu lai.');
  }

  const order = await Order.create({
    email: cleanEmail,
    productId: product.id,
    status: 'pending',
    fulfillmentStatus: FULFILLMENT_STATUSES.PENDING,
    fulfillmentSource: sourceType,
    fulfillmentPayload: preparedOrder?.requestInput
      ? {
          requestInput: preparedOrder.requestInput,
          lifecycle: 'pending_payment',
        }
      : null,
    productSnapshot: buildProductSnapshot(product),
    sourceSnapshot: buildSourceSnapshot(product),
    payment_ref: paymentRef,
    amount,
  });

  notifyAdmin('admin_market_refresh');
  notifyTelegramOrderCreated({
    order,
    product,
    paymentMethod: 'qr',
  });

  const qrUrl = buildVietQrUrl({
    bankBin,
    accountNo,
    accountName,
    amount,
    transferContent: paymentRef,
  });

  return {
    order: normalizeOrderRecord(order),
    qrUrl,
    paymentRef,
    amount,
    transferContent: paymentRef,
  };
};

const applyPaymentWithLock = async ({ paymentRef, providerTxnId, amount }) => {
  await ensureMarketplaceSchema();

  return sequelize.transaction(async (transaction) => {
    if (providerTxnId) {
      const paidByTxn = await Order.findOne({
        where: { payment_txn_id: providerTxnId, status: 'paid' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (paidByTxn) {
        return { type: 'duplicate', order: normalizeOrderRecord(paidByTxn) };
      }
    }

    const order = await Order.findOne({
      where: { payment_ref: paymentRef },
      include: [{ model: Product, as: 'product' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      return { type: 'not_found' };
    }

    if (order.status === 'paid') {
      return { type: 'already_paid', order: normalizeOrderRecord(order) };
    }

    if (order.status !== 'pending') {
      return { type: 'ignored', order: normalizeOrderRecord(order) };
    }

    const expectedAmount = toAmount(order.amount);
    if (amount && expectedAmount && Number(amount) < Number(expectedAmount)) {
      return {
        type: 'amount_mismatch',
        order: normalizeOrderRecord(order),
        expectedAmount,
        amount,
      };
    }

    const sourceType = normalizeFulfillmentSource(
      order.fulfillmentSource || order.product?.sourceType,
    );
    order.fulfillmentPayload = normalizeSourceConfig(order.fulfillmentPayload);
    order.productSnapshot = normalizeSourceConfig(order.productSnapshot);
    order.sourceSnapshot = normalizeSourceConfig(order.sourceSnapshot);
    if (order.product) {
      order.product.sourceConfig = normalizeSourceConfig(order.product.sourceConfig);
    }
    const provider = getFulfillmentProvider(sourceType);
    const fulfillment = await provider.fulfillPaidOrder({ order, transaction });

    order.payment_txn_id = providerTxnId || order.payment_txn_id;
    order.paid_at = new Date();
    order.fulfillmentSource = sourceType;
    if (!order.productSnapshot) order.productSnapshot = buildProductSnapshot(order.product);
    if (!order.sourceSnapshot) order.sourceSnapshot = buildSourceSnapshot(order.product);

    if (!fulfillment?.ok) {
      const nextFulfillmentStatus =
        fulfillment?.fulfillmentStatus || FULFILLMENT_STATUSES.FAILED;
      order.status =
        nextFulfillmentStatus === FULFILLMENT_STATUSES.MANUAL_REVIEW ? 'paid' : 'failed';
      order.fulfillmentStatus = nextFulfillmentStatus;
      order.fulfillmentPayload = {
        ...normalizeSourceConfig(order.fulfillmentPayload),
        lifecycle:
          nextFulfillmentStatus === FULFILLMENT_STATUSES.MANUAL_REVIEW
            ? 'awaiting_admin_retry'
            : 'payment_failed',
        lastError: fulfillment?.message || 'Fulfillment failed.',
        code: fulfillment?.code || 'fulfillment_failed',
        lastFailureAt: new Date().toISOString(),
      };
      await order.save({ transaction });
      return {
        type: fulfillment?.code || 'failed',
        order: normalizeOrderRecord(order),
        fulfillment,
      };
    }

    order.status = 'paid';
    order.fulfillmentStatus =
      fulfillment.fulfillmentStatus || FULFILLMENT_STATUSES.DELIVERED;
    order.stockItemId = fulfillment.stockItemId || order.stockItemId;
    order.fulfillmentPayload = fulfillment.deliveryPayload || order.fulfillmentPayload || null;
    await order.save({ transaction });

    return {
      type:
        order.fulfillmentStatus === FULFILLMENT_STATUSES.PROCESSING ? 'processing' : 'paid',
      order: normalizeOrderRecord(order),
      stockItem: fulfillment.stockItem || null,
      fulfillment,
      deliveryText: extractDeliveryText(fulfillment.deliveryPayload),
    };
  });
};

const processSepayWebhook = async (req) => {
  await ensureMarketplaceSchema();
  await logWebhookRequest(req);

  const verification = verifySepayWebhook(req);
  if (!verification.ok) {
    raise(401, 'Webhook SePay khong hop le.');
  }

  const payload = normalizeSepayPayload(req.body);
  if (!payload.isSuccess) {
    return { ok: true, type: 'ignored', message: 'Bo qua webhook khong phai giao dich thanh cong.' };
  }

  const paymentRef = extractPaymentRef(payload.transferContent);
  if (!paymentRef) {
    return { ok: true, type: 'ignored', message: 'Khong tim thay payment_ref trong noi dung chuyen khoan.' };
  }

  const result = await applyPaymentWithLock({
    paymentRef,
    providerTxnId: payload.providerTxnId,
    amount: payload.amount,
  });

  if (result.type === 'paid' || result.type === 'processing') {
    sendEvent('market', paymentRef, {
      status: result.order?.status || 'paid',
      fulfillmentStatus: result.order?.fulfillmentStatus || null,
    });
    notifyAdmin('admin_market_refresh');

    if (result.type === 'paid') {
      notifyTelegramOrderStatus({
        order: result.order,
        product: result.order?.product,
        title: '[ORDER] Don hang da hoan thanh',
        message: 'He thong da ghi nhan thanh toan va giao hang thanh cong.',
      });

      const deliveryText =
        result.deliveryText || extractDeliveryText(result.order?.fulfillmentPayload);

      if (deliveryText) {
        try {
          await sendMarketplaceDeliveryEmail({
            to: result.order.email,
            productName: result.order.product?.name || 'San pham so',
            productData: deliveryText,
            orderId: result.order.id,
          });
        } catch (emailError) {
          console.error(
            `[Marketplace] Gui email that bai cho don #${result.order.id}:`,
            emailError.message,
          );
        }
      }
    } else if (result.type === 'processing') {
      notifyTelegramOrderStatus({
        order: result.order,
        product: result.order?.product,
        title: '[ORDER] Don hang dang duoc xu ly',
        message: 'He thong da ghi nhan thanh toan va da day don sang supplier.',
      });
    }
  }

  if (result.type === 'supplier_balance_low') {
    notifyTelegramOrderStatus({
      order: result.order,
      product: result.order?.product,
      title: '[ORDER] Don hang can xu ly tay',
      message:
        result.fulfillment?.message ||
        'Vi supplier khong du tien. Can nap them vao panel roi retry don nay.',
      extraLines: ['Huong xu ly: Nap them tien vao vi supplier va bam lam moi / retry fulfillment.'],
    });
  }

  return { ok: true, ...result };
};

const getAdminProducts = async () => {
  await ensureMarketplaceSchema();
  const rows = await Product.findAll({
    include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'storeSection'] }],
    order: [['id', 'DESC']],
  });
  return rows.map(normalizeProductRecord);
};

const getAdminCategories = async () => {
  return Category.findAll({ order: [['id', 'DESC']] });
};

const getAdminStockItems = async ({ page = 1, limit = 20, status, productId } = {}) => {
  await ensureMarketplaceSchema();

  const cleanPage = Number(page) || 1;
  const cleanLimit = Number(limit) || 20;
  const offset = (cleanPage - 1) * cleanLimit;

  const where = {};
  if (status && status !== 'all') where.status = status;
  if (productId) where.productId = productId;

  const result = await StockItem.findAndCountAll({
    where,
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'price'] }],
    order: [['id', 'DESC']],
    limit: cleanLimit,
    offset,
  });

  const totalAvailableStock = await StockItem.count({ where: { status: 'available' } });
  let selectedAvailableStock = 0;
  if (productId) {
    selectedAvailableStock = await StockItem.count({
      where: { status: 'available', productId },
    });
  }

  return {
    items: result.rows,
    total: result.count,
    page: cleanPage,
    totalPages: Math.ceil(result.count / cleanLimit),
    totalAvailableStock,
    selectedAvailableStock,
  };
};

const getAdminOrders = async ({
  status,
  email,
  fulfillmentStatus,
  sourceType,
  page = 1,
  limit = 20,
} = {}) => {
  await ensureMarketplaceSchema();

  const cleanPage = Number(page) || 1;
  const cleanLimit = Number(limit) || 20;
  const offset = (cleanPage - 1) * cleanLimit;

  const where = {};
  const cleanStatus = String(status || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanFulfillmentStatus = String(fulfillmentStatus || '').trim();
  const cleanSourceType = String(sourceType || '').trim();
  if (cleanStatus && cleanStatus !== 'all') where.status = cleanStatus;
  if (cleanEmail) where.email = { [Op.like]: `%${cleanEmail}%` };
  if (cleanFulfillmentStatus && cleanFulfillmentStatus !== 'all') {
    where.fulfillmentStatus = cleanFulfillmentStatus;
  }
  if (cleanSourceType && cleanSourceType !== 'all') {
    where.fulfillmentSource = normalizeFulfillmentSource(cleanSourceType);
  }

  const result = await Order.findAndCountAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'price', 'sourceType'] },
      { model: StockItem, as: 'stockItem', attributes: ['id', 'data', 'status'] },
    ],
    order: [['id', 'DESC']],
    limit: cleanLimit,
    offset,
  });

  return {
    items: result.rows.map(normalizeOrderRecord),
    total: result.count,
    page: cleanPage,
    totalPages: Math.ceil(result.count / cleanLimit),
  };
};

const getPublicOrderSummary = async (paymentRef) => {
  await ensureMarketplaceSchema();
  const cleanPaymentRef = String(paymentRef || '').trim();
  if (!cleanPaymentRef) raise(400, 'Thieu ma thanh toan.');

  const order = await Order.findOne({
    where: { payment_ref: cleanPaymentRef },
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sourceType'] }],
  });

  if (!order) raise(404, 'Khong tim thay don hang.');

  const normalized = normalizeOrderRecord(order);
  const deliveryText = extractDeliveryText(normalized.fulfillmentPayload);
  return {
    id: normalized.id,
    email: normalized.email,
    amount: normalized.amount,
    status: normalized.status,
    fulfillmentStatus: normalized.fulfillmentStatus,
    fulfillmentSource: normalized.fulfillmentSource,
    paymentRef: normalized.payment_ref,
    paidAt: normalized.paid_at || null,
    createdAt: normalized.createdAt || null,
    product: normalized.product
      ? {
          id: normalized.product.id,
          name: normalized.product.name,
          sourceType: normalized.product.sourceType,
        }
      : null,
    supplier: normalized.fulfillmentSource === 'supplier_api'
      ? {
          supplierKind: normalized.sourceSnapshot?.sourceConfig?.supplierKind || null,
          externalStatus: normalized.fulfillmentPayload?.externalStatus || null,
          externalOrderId: normalized.fulfillmentPayload?.externalOrderId || null,
          lastStatusSyncAt: normalized.fulfillmentPayload?.lastStatusSyncAt || null,
        }
      : null,
    delivery:
      normalized.fulfillmentStatus === FULFILLMENT_STATUSES.DELIVERED && deliveryText
        ? {
            channel: normalized.fulfillmentPayload?.channel || 'inline',
            text: deliveryText,
            stockItemId: normalized.fulfillmentPayload?.stockItemId || null,
          }
        : null,
    lastError: normalized.fulfillmentPayload?.lastError || null,
  };
};

const refreshSupplierFulfillmentByOrderId = async (orderId) => {
  await ensureMarketplaceSchema();
  const cleanOrderId = toInt(orderId);
  if (!cleanOrderId || cleanOrderId <= 0) raise(400, 'ID don hang khong hop le.');

  const currentOrder = await Order.findByPk(cleanOrderId, {
    include: [{ model: Product, as: 'product' }],
  });

  if (!currentOrder) raise(404, 'Khong tim thay don hang.');

  const sourceType = normalizeFulfillmentSource(
    currentOrder.fulfillmentSource || currentOrder.product?.sourceType,
  );
  if (sourceType !== 'supplier_api') {
    raise(400, 'Chi co the refresh don supplier_api.');
  }

  const currentPayload = normalizeSourceConfig(currentOrder.fulfillmentPayload);
  const hasExternalOrderId = Boolean(currentPayload?.externalOrderId);
  const canRetryCreateExternalOrder =
    ['paid', 'failed'].includes(currentOrder.status) &&
    [FULFILLMENT_STATUSES.MANUAL_REVIEW, FULFILLMENT_STATUSES.FAILED].includes(
      currentOrder.fulfillmentStatus,
    ) &&
    !hasExternalOrderId &&
    currentPayload?.requestInput;

  if (!canRetryCreateExternalOrder) {
    await applySupplierStatusRefresh(currentOrder, { emitEvents: true });
    return normalizeOrderRecord(currentOrder);
  }

  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(cleanOrderId, {
      include: [{ model: Product, as: 'product' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) raise(404, 'Khong tim thay don hang.');

    order.fulfillmentPayload = normalizeSourceConfig(order.fulfillmentPayload);
    order.sourceSnapshot = normalizeSourceConfig(order.sourceSnapshot);
    if (order.product) {
      order.product.sourceConfig = normalizeSourceConfig(order.product.sourceConfig);
    }

    const provider = getFulfillmentProvider(sourceType);
    const fulfillment = await provider.fulfillPaidOrder({ order, transaction });

    if (!fulfillment?.ok) {
      order.status =
        fulfillment?.fulfillmentStatus === FULFILLMENT_STATUSES.MANUAL_REVIEW
          ? 'paid'
          : 'failed';
      order.fulfillmentStatus =
        fulfillment?.fulfillmentStatus || FULFILLMENT_STATUSES.MANUAL_REVIEW;
      order.fulfillmentPayload = {
        ...normalizeSourceConfig(order.fulfillmentPayload),
        lifecycle: 'awaiting_admin_retry',
        lastError: fulfillment?.message || 'Khong the chay lai don supplier.',
        code: fulfillment?.code || 'retry_failed',
        lastFailureAt: new Date().toISOString(),
      };
      await order.save({ transaction });
      return normalizeOrderRecord(order);
    }

    order.status = 'paid';
    order.fulfillmentStatus =
      fulfillment.fulfillmentStatus || FULFILLMENT_STATUSES.PROCESSING;
    order.fulfillmentPayload = fulfillment.deliveryPayload || order.fulfillmentPayload || null;
    await order.save({ transaction });
    notifyAdmin('admin_market_refresh');
    sendEvent('market', order.payment_ref, {
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
    });
    notifyTelegramOrderStatus({
      order,
      product: order.product,
      title:
        order.fulfillmentStatus === FULFILLMENT_STATUSES.DELIVERED
          ? '[ORDER] Don hang da hoan thanh'
          : '[ORDER] Don hang da duoc retry',
      message:
        order.fulfillmentStatus === FULFILLMENT_STATUSES.DELIVERED
          ? 'Admin da xu ly lai thanh cong va don hang da hoan thanh.'
          : 'Admin da retry fulfillment thanh cong.',
    });
    return normalizeOrderRecord(order);
  });
};

const createOrder = async (email, productId) => {
  const result = await createOrderIntent({ email, productId });
  return { order: result.order, qrUrl: result.qrUrl };
};

const processPayment = async (paymentRef, amount) => {
  const result = await applyPaymentWithLock({ paymentRef, providerTxnId: '', amount });
  if (result.type !== 'paid') return null;
  return {
    order: result.order,
    stockItem: result.stockItem,
    deliveryText: result.deliveryText,
    fulfillment: result.fulfillment,
  };
};

module.exports = {
  listPublicProducts,
  createOrderIntent,
  processSepayWebhook,
  getAdminProducts,
  getAdminCategories,
  getAdminStockItems,
  getAdminOrders,
  getPublicOrderSummary,
  refreshSupplierFulfillmentByOrderId,
  createOrder,
  processPayment,
};
