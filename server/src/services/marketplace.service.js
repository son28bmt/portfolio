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
        authorization: req.headers?.authorization || '',
        'x-secret-key': req.headers?.['x-secret-key'] || '',
        'x-sepay-signature': req.headers?.['x-sepay-signature'] || '',
      },
      body: req.body || {},
    });

    await fs.promises.appendFile(logPath, `${logLine}\n`, 'utf8');
  } catch (error) {
    console.error('[Marketplace] Không ghi được log webhook:', error.message);
  }
};

const extractPaymentRef = (text) => {
  const raw = String(text || '').trim().toUpperCase();
  if (!raw) return '';
  const match = raw.match(/ORD[A-Z0-9]{8,40}/);
  if (match) return match[0];
  return raw.slice(0, 120);
};

const listPublicProducts = async () => {
  return Product.findAll({
    where: { quantity: { [Op.gt]: 0 } },
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    attributes: ['id', 'name', 'description', 'price', 'quantity', 'createdAt', 'categoryId'],
    order: [['id', 'DESC']],
  });
};

const createOrderIntent = async ({ email, productId }) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanProductId = toInt(productId);

  if (!isEmail(cleanEmail)) {
    raise(400, 'Email không hợp lệ.');
  }
  if (!cleanProductId || cleanProductId <= 0) {
    raise(400, 'product_id không hợp lệ.');
  }

  const product = await Product.findByPk(cleanProductId);
  if (!product) {
    raise(404, 'Sản phẩm không tồn tại.');
  }
  if (Number(product.quantity) <= 0) {
    raise(409, 'Sản phẩm đã hết hàng.');
  }

  const amount = toAmount(product.price);
  if (!amount || amount <= 0) {
    raise(400, 'Sản phẩm chưa có giá hợp lệ.');
  }

  const { bankBin, accountNo, accountName } = getPaymentConfig();
  if (!bankBin || !accountNo || !accountName) {
    raise(500, 'Thiếu cấu hình tài khoản nhận tiền cho SePay/VietQR.');
  }

  let paymentRef = '';
  for (let i = 0; i < 5; i += 1) {
    paymentRef = generatePaymentRef();
    const existed = await Order.findOne({ where: { payment_ref: paymentRef }, attributes: ['id'] });
    if (!existed) break;
  }
  if (!paymentRef) {
    raise(500, 'Không thể tạo mã thanh toán, vui lòng thử lại.');
  }

  const order = await Order.create({
    email: cleanEmail,
    productId: product.id,
    status: 'pending',
    payment_ref: paymentRef,
    amount,
  });

  notifyAdmin('admin_market_refresh');

  const qrUrl = buildVietQrUrl({
    bankBin,
    accountNo,
    accountName,
    amount,
    transferContent: paymentRef,
  });

  return {
    order,
    qrUrl,
    paymentRef,
    amount,
    transferContent: paymentRef,
  };
};

const applyPaymentWithLock = async ({ paymentRef, providerTxnId, amount }) => {
  return sequelize.transaction(async (transaction) => {
    if (providerTxnId) {
      const paidByTxn = await Order.findOne({
        where: { payment_txn_id: providerTxnId, status: 'paid' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (paidByTxn) {
        return { type: 'duplicate', order: paidByTxn };
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
      return { type: 'already_paid', order };
    }

    if (order.status !== 'pending') {
      return { type: 'ignored', order };
    }

    const expectedAmount = toAmount(order.amount);
    if (amount && expectedAmount && Number(amount) < Number(expectedAmount)) {
      return { type: 'amount_mismatch', order, expectedAmount, amount };
    }

    const stockItem = await StockItem.findOne({
      where: { productId: order.productId, status: 'available' },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });

    if (!stockItem) {
      order.status = 'failed';
      await order.save({ transaction });
      return { type: 'out_of_stock', order };
    }

    stockItem.status = 'sold';
    await stockItem.save({ transaction });

    order.stockItemId = stockItem.id;
    order.status = 'paid';
    order.payment_txn_id = providerTxnId || order.payment_txn_id;
    order.paid_at = new Date();
    await order.save({ transaction });

    await Product.update(
      { quantity: sequelize.literal('GREATEST(quantity - 1, 0)') },
      { where: { id: order.productId }, transaction }
    );

    return { type: 'paid', order, stockItem };
  });
};

const processSepayWebhook = async (req) => {
  await logWebhookRequest(req);

  const verification = verifySepayWebhook(req);
  if (!verification.ok) {
    raise(401, 'Webhook SePay không hợp lệ.');
  }

  const payload = normalizeSepayPayload(req.body);
  if (!payload.isSuccess) {
    return { ok: true, type: 'ignored', message: 'Bỏ qua webhook không phải giao dịch thành công.' };
  }

  const paymentRef = extractPaymentRef(payload.transferContent);
  if (!paymentRef) {
    return { ok: true, type: 'ignored', message: 'Không tìm thấy payment_ref trong nội dung chuyển khoản.' };
  }

  const result = await applyPaymentWithLock({
    paymentRef,
    providerTxnId: payload.providerTxnId,
    amount: payload.amount,
  });

  if (result.type === 'paid') {
    sendEvent('market', paymentRef, { status: 'paid' });
    notifyAdmin('admin_market_refresh');
    try {
      await sendMarketplaceDeliveryEmail({
        to: result.order.email,
        productName: result.order.product?.name || 'Sản phẩm số',
        productData: result.stockItem.data,
        orderId: result.order.id,
      });
    } catch (emailError) {
      console.error(`[Marketplace] Gửi email thất bại cho đơn #${result.order.id}:`, emailError.message);
    }
  }

  return { ok: true, ...result };
};

const getAdminProducts = async () => {
  return Product.findAll({
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    order: [['id', 'DESC']],
  });
};

const getAdminCategories = async () => {
  return Category.findAll({ order: [['id', 'DESC']] });
};

const getAdminStockItems = async () => {
  return StockItem.findAll({
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'price'] }],
    order: [['id', 'DESC']],
  });
};

const getAdminOrders = async ({ status, email }) => {
  const where = {};
  const cleanStatus = String(status || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanStatus) where.status = cleanStatus;
  if (cleanEmail) where.email = { [Op.like]: `%${cleanEmail}%` };

  return Order.findAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'price'] },
      { model: StockItem, as: 'stockItem', attributes: ['id', 'data', 'status'] },
    ],
    order: [['id', 'DESC']],
  });
};

const createOrder = async (email, productId) => {
  const result = await createOrderIntent({ email, productId });
  return { order: result.order, qrUrl: result.qrUrl };
};

const processPayment = async (paymentRef, amount) => {
  const result = await applyPaymentWithLock({ paymentRef, providerTxnId: '', amount });
  if (result.type !== 'paid') return null;
  return { order: result.order, stockItem: result.stockItem };
};

module.exports = {
  listPublicProducts,
  createOrderIntent,
  processSepayWebhook,
  getAdminProducts,
  getAdminCategories,
  getAdminStockItems,
  getAdminOrders,
  createOrder,
  processPayment,
};
