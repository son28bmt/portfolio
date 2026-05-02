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
  getEffectivePaymentConfig,
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
const {
  getMarketplaceSectionStatus,
  saveMarketplaceSectionStatus,
} = require('../services/marketplace-section-status.service');
const { listSmmServices, getSmmBalance } = require('../services/smm-panel.service');
const { listCardProducts, getCardBalance } = require('../services/card-partner.service');
const { addClient } = require('../services/sse.service');

const signAdminToken = (adminId) =>
  jwt.sign({ adminId, role: 'marketplace_admin' }, getJwtSecret(), {
    expiresIn: process.env.ADMIN_JWT_EXPIRES || '7d',
  });

const handleError = (res, error) => {
  const status = Number(error?.status || 500);
  return res.status(status).json({ message: error?.message || 'Có lỗi xảy ra.' });
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

const publicGetPaymentAccounts = async (req, res) => {
  try {
    const config = await getEffectivePaymentConfig();
    return res.json({ items: config.paymentAccounts || [] });
  } catch (error) {
    return handleError(res, error);
  }
};

const publicGetSectionStatus = async (req, res) => {
  try {
    const sections = await getMarketplaceSectionStatus();
    return res.json({ sections });
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
      bankKey,
    } = req.body || {};
    const result = await createOrderIntent({
      email,
      productId: productIdFromClient ?? productId,
      bankKey,
      orderInput: {
        targetLink,
        quantity,
        comments,
      },
    });

    return res.status(201).json({
      message: 'Tạo đơn hàng thành công, vui lòng quét mã để thanh toán.',
      order: result.order,
      qr_url: result.qrUrl,
      payment_ref: result.paymentRef,
      transfer_content: result.transferContent,
      amount: result.amount,
      bankKey: result.bankKey,
      bankLabel: result.bankLabel,
      bankBin: result.bankBin,
      accountNo: result.accountNo,
      accountName: result.accountName,
      paymentAccounts: result.paymentAccounts,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const publicGetOrderStatus = async (req, res) => {
  try {
    const paymentRef = String(req.params.payment_ref || '').trim();
    if (!paymentRef) return res.status(400).json({ message: 'Thiếu mã thanh toán.' });

    const order = await Order.findOne({
      where: { payment_ref: paymentRef },
      attributes: ['status', 'fulfillmentStatus'],
    });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

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
  if (!paymentRef) return res.status(400).json({ message: 'Thiếu mã thanh toán.' });
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
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.' });
    }

    const admin = await Admin.findOne({ where: { username } });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu.' });
    }

    const token = signAdminToken(admin.id);
    return res.json({
      message: 'Đăng nhập thành công.',
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

const adminGetSectionStatus = async (req, res) => {
  try {
    const sections = await getMarketplaceSectionStatus();
    return res.json({ sections });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminUpdateSectionStatus = async (req, res) => {
  try {
    const sections = await saveMarketplaceSectionStatus(req.body?.sections || req.body || {});
    return res.json({ sections });
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
      return res.status(400).json({ message: 'Thiếu dữ liệu sản phẩm hợp lệ.' });
    }

    const category = await Category.findByPk(cleanCategoryId);
    if (!category) {
      return res.status(404).json({ message: 'Danh mục không tồn tại.' });
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
    if (!id) return res.status(400).json({ message: 'ID sản phẩm không hợp lệ.' });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });

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
      if (!category) return res.status(404).json({ message: 'Danh mục không tồn tại.' });
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
      message: 'Đã đồng bộ catalog từ SMM panel vào admin.',
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
      message: 'Đã đồng bộ catalog card vào admin.',
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
      message: 'Đã quét hàng đợi supplier.',
      ...summary,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminDeleteProduct = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID sản phẩm không hợp lệ.' });

    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });

    await product.destroy();
    return res.json({ message: 'Đã xóa sản phẩm.' });
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
      return res.status(400).json({ message: 'Thiếu dữ liệu kho hàng hợp lệ.' });
    }

    const product = await Product.findByPk(cleanProductId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });

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
      message: `Đã thêm ${createdItems.length} mục vào kho hàng.`,
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
    if (!id) return res.status(400).json({ message: 'ID stock item không hợp lệ.' });

    const item = await StockItem.findByPk(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy stock item.' });

    const beforeStatus = item.status;
    const payload = {};
    if (req.body.data !== undefined) payload.data = String(req.body.data).trim();
    if (req.body.status !== undefined) payload.status = req.body.status === 'sold' ? 'sold' : 'available';

    if (req.body.product_id !== undefined || req.body.productId !== undefined) {
      const nextProductId = toInt(req.body.product_id ?? req.body.productId);
      if (!nextProductId) return res.status(400).json({ message: 'product_id không hợp lệ.' });
      const product = await Product.findByPk(nextProductId);
      if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });
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
    if (!id) return res.status(400).json({ message: 'ID stock item không hợp lệ.' });

    const item = await StockItem.findByPk(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy stock item.' });

    if (item.status === 'available') {
      const product = await Product.findByPk(item.productId);
      if (product && Number(product.quantity) > 0) {
        await product.decrement('quantity', { by: 1 });
      }
    }

    await item.destroy();
    return res.json({ message: 'Đã xóa stock item.' });
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
    if (!name) return res.status(400).json({ message: 'Tên danh mục không được để trống.' });
    const storeSection = normalizeStoreSection(req.body?.storeSection);

    const existed = await Category.findOne({ where: { name } });
    if (existed) return res.status(409).json({ message: 'Danh mục đã tồn tại.' });

    const category = await Category.create({ name, storeSection });
    return res.status(201).json(category);
  } catch (error) {
    return handleError(res, error);
  }
};

const adminUpdateCategory = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID danh mục không hợp lệ.' });
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Tên danh mục không được để trống.' });
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
    if (!id) return res.status(400).json({ message: 'ID danh mục không hợp lệ.' });
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
    await category.destroy();
    return res.json({ message: 'Đã xóa danh mục.' });
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
    if (!id) return res.status(400).json({ message: 'ID đơn hàng không hợp lệ.' });
    const order = await Order.findByPk(id, {
      include: [
        { model: Product, as: 'product' },
        { model: StockItem, as: 'stockItem' },
      ],
    });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
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
      return res.status(400).json({ message: 'Thiếu dữ liệu tạo đơn.' });
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
    if (!id) return res.status(400).json({ message: 'ID đơn hàng không hợp lệ.' });
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

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
    if (!id) return res.status(400).json({ message: 'ID đơn hàng không hợp lệ.' });
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    await order.destroy();
    return res.json({ message: 'Đã xóa đơn hàng.' });
  } catch (error) {
    return handleError(res, error);
  }
};

const adminDeleteAllCardProducts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    // Fetch all products that MIGHT be cards
    const products = await Product.findAll({
      where: {
        sourceType: 'supplier_api'
      }
    });

    const cardProducts = products.filter(p => {
      try {
        const config = typeof p.sourceConfig === 'string' ? JSON.parse(p.sourceConfig) : (p.sourceConfig || {});
        const provider = String(config.cardProviderCode || config.providerCode || '').toLowerCase();
        const kind = String(config.supplierKind || '').toLowerCase();
        
        // Match card_partner provider or digital_code kind
        return provider === 'card_partner' || kind === 'digital_code';
      } catch (e) {
        return false;
      }
    });

    const ids = cardProducts.map(p => p.id);
    if (ids.length === 0) {
      return res.json({ 
        message: 'Không tìm thấy sản phẩm card nào đã đồng bộ để xóa.', 
        count: 0 
      });
    }

    const deletedCount = await Product.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });

    return res.json({ 
      message: `Đã xóa thành công ${deletedCount} sản phẩm card khỏi hệ thống.`, 
      count: deletedCount 
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  publicGetProducts,
  publicGetPaymentAccounts,
  publicGetSectionStatus,
  publicCreateOrder,
  publicGetOrderStatus,
  publicGetOrderSummary,
  publicGetOrderSSE,
  webhookSePay,
  adminLogin,
  adminGetSectionStatus,
  adminUpdateSectionStatus,
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
  adminDeleteAllCardProducts,
};

