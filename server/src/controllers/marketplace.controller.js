const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/db');
const { Admin, Product, StockItem, Category, Order } = require('../models');
const { getJwtSecret } = require('../utils/jwt.util');
const {
  listPublicProducts,
  createOrderIntent,
  processSepayWebhook,
  getAdminProducts,
  getAdminStockItems,
  getAdminCategories,
  getAdminOrders,
  getPublicOrderSummary,
  refreshSupplierFulfillmentByOrderId,
} = require('../services/marketplace.service');
const {
  syncSmmPanelServicesToCatalog,
  autoRefreshSupplierOrdersBatch,
} = require('../services/marketplace-supplier-sync.service');
const { syncCardCatalogToMarketplace } = require('../services/marketplace-card-sync.service');
const {
  FULFILLMENT_SOURCES,
  normalizeFulfillmentSource,
  buildProductSourceConfig,
} = require('../services/marketplace-fulfillment.service');
const { listSmmServices, getSmmBalance } = require('../services/smm-panel.service');
const { listCardProducts, getCardBalance } = require('../services/card-partner.service');
const { addClient } = require('../services/sse.service');

const signAdminToken = (adminId) =>
  jwt.sign({ adminId, role: 'marketplace_admin' }, getJwtSecret(), {
    expiresIn: process.env.ADMIN_JWT_EXPIRES || '7d',
  });

const handleError = (res, error) => {
  const status = Number(error?.status || 500);
  return res.status(status).json({ message: error?.message || 'Co loi xay ra.' });
};

const toInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const normalizeStoreSection = (value) => {
  const clean = String(value || '').trim().toLowerCase();
  if (['service', 'custom', 'card'].includes(clean)) return clean;
  return 'service';
};

const parseSourceTypeFromBody = (body = {}, fallback = FULFILLMENT_SOURCES.LOCAL_STOCK) => {
  if (body?.sourceType === undefined) return normalizeFulfillmentSource(fallback);
  return normalizeFulfillmentSource(body.sourceType);
};

const publicGetProducts = async (req, res) => {
  try {
    const products = await listPublicProducts();
    return res.json(products);
  } catch (error) {
    return handleError(res, error);
  }
};

const publicCreateOrder = async (req, res) => {
  try {
    const {
      email,
      product_id: productIdFromClient,
      productId,
      targetLink,
      quantity,
      comments,
    } = req.body || {};
    const result = await createOrderIntent({
      email,
      productId: productIdFromClient ?? productId,
      orderInput: {
        targetLink,
        quantity,
        comments,
      },
    });

    return res.status(201).json({
      message: 'Tao don hang thanh cong, vui long quet ma de thanh toan.',
      order: result.order,
      qr_url: result.qrUrl,
      payment_ref: result.paymentRef,
      transfer_content: result.transferContent,
      amount: result.amount,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const publicGetOrderStatus = async (req, res) => {
  try {
    const paymentRef = String(req.params.payment_ref || '').trim();
    if (!paymentRef) return res.status(400).json({ message: 'Thieu ma thanh toan.' });

    const order = await Order.findOne({
      where: { payment_ref: paymentRef },
      attributes: ['status', 'fulfillmentStatus'],
    });
    if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });

    return res.json({
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const publicGetOrderSummary = async (req, res) => {
  try {
    const summary = await getPublicOrderSummary(req.params.payment_ref);
    return res.json(summary);
  } catch (error) {
    return handleError(res, error);
  }
};

const publicGetOrderSSE = (req, res) => {
  const paymentRef = String(req.params.payment_ref || '').trim();
  if (!paymentRef) return res.status(400).json({ message: 'Thieu ma thanh toan.' });
  addClient(req, res, 'market', paymentRef);
};

const webhookSePay = async (req, res) => {
  try {
    const result = await processSepayWebhook(req);
    return res.status(200).json({ success: true, webhookType: 'order', ...result });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminLogin = async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Vui long nhap day du tai khoan va mat khau.' });
    }

    const admin = await Admin.findOne({ where: { username } });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ message: 'Sai tai khoan hoac mat khau.' });
    }

    const token = signAdminToken(admin.id);
    return res.json({
      message: 'Dang nhap thanh cong.',
      token,
      admin: { id: admin.id, username: admin.username },
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetProducts = async (req, res) => {
  try {
    const products = await getAdminProducts();
    return res.json(products);
  } catch (error) {
    return handleError(res, error);
  }
};

const parseSourceConfigFromBody = (body = {}, fallbackSourceType) =>
  buildProductSourceConfig({
    sourceType: parseSourceTypeFromBody(body, fallbackSourceType),
    sourceConfig: body?.sourceConfig,
  });

const adminCreateProduct = async (req, res) => {
  try {
    const { name, description, price, category_id: categoryIdRaw, categoryId } = req.body || {};
    const cleanCategoryId = toInt(categoryIdRaw ?? categoryId);
    const sourceType = parseSourceTypeFromBody(req.body || {});
    const sourceConfig = parseSourceConfigFromBody(req.body || {}, sourceType);

    if (!name || cleanCategoryId === null || Number(price) <= 0) {
      return res.status(400).json({ message: 'Thieu du lieu san pham hop le.' });
    }

    const category = await Category.findByPk(cleanCategoryId);
    if (!category) {
      return res.status(404).json({ message: 'Danh muc khong ton tai.' });
    }

    const product = await Product.create({
      name: String(name).trim(),
      description: description || '',
      price: Math.round(Number(price)),
      categoryId: cleanCategoryId,
      quantity: 0,
      sourceType,
      sourceConfig,
    });

    return res.status(201).json(product);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminUpdateProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID san pham khong hop le.' });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });

    const payload = {};
    if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (req.body.price !== undefined) payload.price = Math.round(Number(req.body.price) || 0);
    if (req.body.quantity !== undefined) payload.quantity = Math.max(0, Number(req.body.quantity) || 0);
    if (req.body.sourceType !== undefined || req.body.sourceConfig !== undefined) {
      payload.sourceType = parseSourceTypeFromBody(req.body || {}, product.sourceType);
      payload.sourceConfig = buildProductSourceConfig({
        sourceType: payload.sourceType,
        sourceConfig: req.body?.sourceConfig ?? product.sourceConfig,
      });
    }
    if (req.body.category_id !== undefined || req.body.categoryId !== undefined) {
      payload.categoryId = toInt(req.body.category_id ?? req.body.categoryId);
    }

    if (payload.categoryId !== undefined) {
      const category = await Category.findByPk(payload.categoryId);
      if (!category) return res.status(404).json({ message: 'Danh muc khong ton tai.' });
    }

    await product.update(payload);
    return res.json(product);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminRefreshSupplierOrder = async (req, res) => {
  try {
    const order = await refreshSupplierFulfillmentByOrderId(req.params.id);
    return res.json(order);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetSmmServices = async (req, res) => {
  try {
    const items = await listSmmServices();
    return res.json({ items });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetSmmBalance = async (req, res) => {
  try {
    const balance = await getSmmBalance();
    return res.json(balance);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetCardProducts = async (req, res) => {
  try {
    const items = await listCardProducts();
    return res.json({ items });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetCardBalance = async (req, res) => {
  try {
    const balance = await getCardBalance();
    return res.json(balance);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminSyncSmmServices = async (req, res) => {
  try {
    const result = await syncSmmPanelServicesToCatalog(req.body || {});
    return res.json({
      message: 'Da dong bo catalog tu SMM panel vao admin.',
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminSyncCardProducts = async (req, res) => {
  try {
    const result = await syncCardCatalogToMarketplace(req.body || {});
    return res.json({
      message: 'Da dong bo catalog card vao admin.',
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminBatchRefreshSupplierOrders = async (req, res) => {
  try {
    const summary = await autoRefreshSupplierOrdersBatch({
      limit: req.body?.limit,
      minAgeMs: req.body?.minAgeMs,
    });
    return res.json({
      message: 'Da quet hang doi supplier.',
      ...summary,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminDeleteProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID san pham khong hop le.' });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });

    await product.destroy();
    return res.json({ message: 'Da xoa san pham.' });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetStockItems = async (req, res) => {
  try {
    const { page, limit, status, productId } = req.query;
    const items = await getAdminStockItems({ page, limit, status, productId });
    return res.json(items);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminCreateStockItem = async (req, res) => {
  try {
    const { product_id: productIdRaw, productId, data, status, quantity } = req.body || {};
    const cleanProductId = toInt(productIdRaw ?? productId);
    const cleanData = String(data || '').trim();
    const rawQuantity = Number(quantity ?? 1);
    const cleanQuantity = Number.isFinite(rawQuantity) ? Math.max(1, Math.floor(rawQuantity)) : 1;

    if (!cleanProductId || !cleanData) {
      return res.status(400).json({ message: 'Thieu du lieu kho hang hop le.' });
    }

    const product = await Product.findByPk(cleanProductId);
    if (!product) return res.status(404).json({ message: 'San pham khong ton tai.' });

    const finalStatus = status === 'sold' ? 'sold' : 'available';
    const dataLines = cleanData
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

    const normalizedDataList =
      dataLines.length > 1 ? dataLines : Array.from({ length: cleanQuantity }, () => cleanData);

    const createdItems = await sequelize.transaction(async (transaction) => {
      const items = await StockItem.bulkCreate(
        normalizedDataList.map((itemData) => ({
          productId: cleanProductId,
          data: itemData,
          status: finalStatus,
        })),
        { transaction },
      );

      if (finalStatus === 'available' && items.length > 0) {
        await Product.increment(
          { quantity: items.length },
          {
            where: { id: cleanProductId },
            transaction,
          },
        );
      }

      return items;
    });

    return res.status(201).json({
      message: `Da them ${createdItems.length} muc vao kho hang.`,
      createdCount: createdItems.length,
      items: createdItems,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminUpdateStockItem = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID stock item khong hop le.' });

    const item = await StockItem.findByPk(id);
    if (!item) return res.status(404).json({ message: 'Khong tim thay stock item.' });

    const beforeStatus = item.status;
    const payload = {};
    if (req.body.data !== undefined) payload.data = String(req.body.data).trim();
    if (req.body.status !== undefined) payload.status = req.body.status === 'sold' ? 'sold' : 'available';

    if (req.body.product_id !== undefined || req.body.productId !== undefined) {
      const nextProductId = toInt(req.body.product_id ?? req.body.productId);
      if (!nextProductId) return res.status(400).json({ message: 'product_id khong hop le.' });
      const product = await Product.findByPk(nextProductId);
      if (!product) return res.status(404).json({ message: 'San pham khong ton tai.' });
      payload.productId = nextProductId;
    }

    await item.update(payload);

    if (beforeStatus !== item.status) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        if (beforeStatus === 'sold' && item.status === 'available') {
          await product.increment('quantity', { by: 1 });
        } else if (beforeStatus === 'available' && item.status === 'sold') {
          if (Number(product.quantity) > 0) {
            await product.decrement('quantity', { by: 1 });
          }
        }
      }
    }

    return res.json(item);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminDeleteStockItem = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID stock item khong hop le.' });

    const item = await StockItem.findByPk(id);
    if (!item) return res.status(404).json({ message: 'Khong tim thay stock item.' });

    if (item.status === 'available') {
      const product = await Product.findByPk(item.productId);
      if (product && Number(product.quantity) > 0) {
        await product.decrement('quantity', { by: 1 });
      }
    }

    await item.destroy();
    return res.json({ message: 'Da xoa stock item.' });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetCategories = async (req, res) => {
  try {
    const categories = await getAdminCategories();
    return res.json(categories);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminCreateCategory = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Ten danh muc khong duoc de trong.' });
    const storeSection = normalizeStoreSection(req.body?.storeSection);

    const existed = await Category.findOne({ where: { name } });
    if (existed) return res.status(409).json({ message: 'Danh muc da ton tai.' });

    const category = await Category.create({ name, storeSection });
    return res.status(201).json(category);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminUpdateCategory = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID danh muc khong hop le.' });
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Khong tim thay danh muc.' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Ten danh muc khong duoc de trong.' });
    const storeSection = normalizeStoreSection(req.body?.storeSection ?? category.storeSection);

    category.name = name;
    category.storeSection = storeSection;
    await category.save();
    return res.json(category);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminDeleteCategory = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID danh muc khong hop le.' });
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Khong tim thay danh muc.' });
    await category.destroy();
    return res.json({ message: 'Da xoa danh muc.' });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetOrders = async (req, res) => {
  try {
    const { page, limit, status, email, fulfillmentStatus, sourceType } = req.query;
    const orders = await getAdminOrders({
      status,
      email,
      fulfillmentStatus,
      sourceType,
      page,
      limit,
    });
    return res.json(orders);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminGetOrderById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID don hang khong hop le.' });
    const order = await Order.findByPk(id, {
      include: [
        { model: Product, as: 'product' },
        { model: StockItem, as: 'stockItem' },
      ],
    });
    if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
    return res.json(order);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminCreateOrder = async (req, res) => {
  try {
    const { email, product_id: productIdRaw, productId } = req.body || {};
    const cleanProductId = toInt(productIdRaw ?? productId);
    if (!cleanProductId || !email) {
      return res.status(400).json({ message: 'Thieu du lieu tao don.' });
    }
    const result = await createOrderIntent({ email, productId: cleanProductId });
    return res.status(201).json(result.order);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminUpdateOrder = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID don hang khong hop le.' });
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });

    const payload = {};
    if (req.body.email !== undefined) payload.email = String(req.body.email).trim().toLowerCase();
    if (req.body.status !== undefined) payload.status = req.body.status;
    if (req.body.fulfillmentStatus !== undefined) payload.fulfillmentStatus = req.body.fulfillmentStatus;
    if (req.body.payment_ref !== undefined) payload.payment_ref = String(req.body.payment_ref).trim();
    if (req.body.payment_txn_id !== undefined) payload.payment_txn_id = String(req.body.payment_txn_id).trim();
    await order.update(payload);
    return res.json(order);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminDeleteOrder = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID don hang khong hop le.' });
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Khong tim thay don hang.' });
    await order.destroy();
    return res.json({ message: 'Da xoa don hang.' });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  publicGetProducts,
  publicCreateOrder,
  publicGetOrderStatus,
  publicGetOrderSummary,
  publicGetOrderSSE,
  webhookSePay,
  adminLogin,
  adminGetProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminGetStockItems,
  adminCreateStockItem,
  adminUpdateStockItem,
  adminDeleteStockItem,
  adminGetCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  adminGetOrders,
  adminGetOrderById,
  adminCreateOrder,
  adminUpdateOrder,
  adminDeleteOrder,
  adminRefreshSupplierOrder,
  adminGetSmmServices,
  adminGetSmmBalance,
  adminGetCardProducts,
  adminGetCardBalance,
  adminSyncSmmServices,
  adminSyncCardProducts,
  adminBatchRefreshSupplierOrders,
};
