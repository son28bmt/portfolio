const { sequelize } = require('../config/db');
const { Product, StockItem } = require('../models');
const {
  assertSmmConfigured,
  createSmmOrder,
  getSmmOrderStatus,
} = require('./smm-panel.service');

const FULFILLMENT_SOURCES = {
  LOCAL_STOCK: 'local_stock',
  SUPPLIER_API: 'supplier_api',
};

const SUPPLIER_KINDS = {
  SMM_PANEL: 'smm_panel',
  DIGITAL_CODE: 'digital_code',
};

const SMM_PRICING_MODELS = {
  FIXED: 'fixed',
  PER_1000: 'per_1000',
  PER_UNIT: 'per_unit',
};

const FULFILLMENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  MANUAL_REVIEW: 'manual_review',
};

const createMarketplaceError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const safeJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const sanitizeText = (value, max = 255) => String(value || '').trim().slice(0, max);

const toInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
};

const normalizeFulfillmentSource = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === FULFILLMENT_SOURCES.SUPPLIER_API) return FULFILLMENT_SOURCES.SUPPLIER_API;
  return FULFILLMENT_SOURCES.LOCAL_STOCK;
};

const normalizeSupplierKind = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === SUPPLIER_KINDS.DIGITAL_CODE) return SUPPLIER_KINDS.DIGITAL_CODE;
  return SUPPLIER_KINDS.SMM_PANEL;
};

const normalizeSmmPricingModel = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === SMM_PRICING_MODELS.FIXED) return SMM_PRICING_MODELS.FIXED;
  if (raw === SMM_PRICING_MODELS.PER_UNIT) return SMM_PRICING_MODELS.PER_UNIT;
  return SMM_PRICING_MODELS.PER_1000;
};

const normalizeSourceConfig = (value) => safeJsonObject(value);

const buildProductSourceConfig = ({ sourceType, sourceConfig } = {}) => {
  const normalizedSource = normalizeFulfillmentSource(sourceType);
  const normalizedConfig = normalizeSourceConfig(sourceConfig);
  if (normalizedSource === FULFILLMENT_SOURCES.LOCAL_STOCK) {
    return normalizedConfig;
  }

  const supplierKind = normalizeSupplierKind(normalizedConfig.supplierKind);
  const baseConfig = {
    supplierKind,
    supplierSku: sanitizeText(normalizedConfig.supplierSku, 120) || null,
    supplierProductId: sanitizeText(normalizedConfig.supplierProductId, 120) || null,
    providerCode: sanitizeText(normalizedConfig.providerCode, 80) || null,
    cardProviderCode: sanitizeText(normalizedConfig.cardProviderCode, 120) || null,
    cardSku: sanitizeText(normalizedConfig.cardSku, 120) || null,
  };

  if (supplierKind === SUPPLIER_KINDS.DIGITAL_CODE) {
    return {
      ...normalizedConfig,
      ...baseConfig,
      requiresTargetLink: false,
      requiresComments: false,
      pricingModel: SMM_PRICING_MODELS.FIXED,
    };
  }

  return {
    ...normalizedConfig,
    ...baseConfig,
    supplierKind: SUPPLIER_KINDS.SMM_PANEL,
    serviceId: sanitizeText(normalizedConfig.serviceId, 80) || null,
    pricingModel: normalizeSmmPricingModel(normalizedConfig.pricingModel),
    minQuantity: toInt(normalizedConfig.minQuantity),
    maxQuantity: toInt(normalizedConfig.maxQuantity),
    defaultQuantity: toInt(normalizedConfig.defaultQuantity),
    requiresTargetLink: normalizedConfig.requiresTargetLink !== false,
    requiresComments: Boolean(normalizedConfig.requiresComments),
    fixedTarget: sanitizeText(normalizedConfig.fixedTarget, 1000) || '',
    fixedComments: sanitizeText(normalizedConfig.fixedComments, 4000) || '',
    targetLabel: sanitizeText(normalizedConfig.targetLabel, 120) || 'Link mục tiêu',
    commentsLabel: sanitizeText(normalizedConfig.commentsLabel, 120) || 'Nội dung comments',
    serviceName: sanitizeText(normalizedConfig.serviceName, 255) || '',
    categoryName: sanitizeText(normalizedConfig.categoryName, 255) || '',
    refill: Boolean(normalizedConfig.refill),
    cancel: Boolean(normalizedConfig.cancel),
  };
};

const buildProductSnapshot = (product) => ({
  id: product?.id ?? null,
  name: sanitizeText(product?.name, 255),
  price: Number(product?.price || 0),
  categoryId: product?.categoryId ?? null,
  sourceType: normalizeFulfillmentSource(product?.sourceType),
  supplierKind:
    normalizeFulfillmentSource(product?.sourceType) === FULFILLMENT_SOURCES.SUPPLIER_API
      ? normalizeSupplierKind(product?.sourceConfig?.supplierKind)
      : null,
});

const buildSourceSnapshot = (product) => ({
  sourceType: normalizeFulfillmentSource(product?.sourceType),
  sourceConfig: buildProductSourceConfig({
    sourceType: product?.sourceType,
    sourceConfig: product?.sourceConfig,
  }),
});

const extractDeliveryText = (payload) => {
  const raw = payload?.deliveryText ?? payload?.content ?? payload?.data ?? '';
  return String(raw || '').trim();
};

const normalizeOrderInput = (value = {}) => ({
  targetLink: sanitizeText(value.targetLink || value.link, 1000),
  quantity: toInt(value.quantity),
  comments: sanitizeText(value.comments, 4000),
});

const resolveSmmTargetLink = (config, orderInput) => {
  const targetLink = sanitizeText(orderInput?.targetLink || '', 1000) || config.fixedTarget;
  if (config.requiresTargetLink && !targetLink) {
    throw createMarketplaceError(400, 'Vui long nhap link muc tieu.');
  }
  return targetLink || '';
};

const resolveSmmComments = (config, orderInput) => {
  const comments = sanitizeText(orderInput?.comments || '', 4000) || config.fixedComments;
  if (config.requiresComments && !comments) {
    throw createMarketplaceError(400, 'Vui long nhap noi dung comments.');
  }
  return comments || '';
};

const resolveSmmQuantity = (config, orderInput) => {
  const quantity = toInt(orderInput?.quantity) || config.defaultQuantity || config.minQuantity;
  if (!quantity || quantity <= 0) {
    throw createMarketplaceError(400, 'So luong khong hop le.');
  }
  if (config.minQuantity && quantity < config.minQuantity) {
    throw createMarketplaceError(400, `So luong toi thieu la ${config.minQuantity}.`);
  }
  if (config.maxQuantity && quantity > config.maxQuantity) {
    throw createMarketplaceError(400, `So luong toi da la ${config.maxQuantity}.`);
  }
  return quantity;
};

const calculateSmmAmount = ({ productPrice, quantity, pricingModel }) => {
  const basePrice = Number(productPrice || 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    throw createMarketplaceError(400, 'San pham chua co gia hop le.');
  }

  if (pricingModel === SMM_PRICING_MODELS.FIXED) {
    return Math.round(basePrice);
  }
  if (pricingModel === SMM_PRICING_MODELS.PER_UNIT) {
    return Math.round(basePrice * quantity);
  }

  return Math.round((basePrice * quantity) / 1000);
};

const mapExternalStatusToFulfillment = (status) => {
  const normalized = sanitizeText(status, 60).toLowerCase();
  if (normalized === 'completed') return FULFILLMENT_STATUSES.DELIVERED;
  if (normalized === 'pending' || normalized === 'processing' || normalized === 'in progress') {
    return FULFILLMENT_STATUSES.PROCESSING;
  }
  if (normalized === 'partial' || normalized === 'canceled') {
    return FULFILLMENT_STATUSES.MANUAL_REVIEW;
  }
  return FULFILLMENT_STATUSES.MANUAL_REVIEW;
};

const isSupplierBalanceError = (error) => {
  const message = sanitizeText(error?.message || '', 500).toLowerCase();
  if (!message) return false;

  return (
    message.includes('insufficient') ||
    message.includes('not enough funds') ||
    message.includes('not enough balance') ||
    message.includes('low balance') ||
    message.includes('balance') ||
    message.includes('so du') ||
    message.includes('khong du tien') ||
    message.includes('thiếu tiền') ||
    message.includes('thieu tien')
  );
};

const localStockProvider = {
  async assertProductReady({ product }) {
    if (!product) {
      throw createMarketplaceError(404, 'San pham khong ton tai.');
    }

    if (Number(product.quantity) <= 0) {
      throw createMarketplaceError(409, 'San pham da het hang.');
    }
  },

  async prepareOrderIntent({ product }) {
    return {
      amount: Math.round(Number(product?.price || 0)),
      requestInput: null,
    };
  },

  async fulfillPaidOrder({ order, transaction }) {
    const stockItem = await StockItem.findOne({
      where: { productId: order.productId, status: 'available' },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });

    if (!stockItem) {
      return {
        ok: false,
        code: 'out_of_stock',
        message: 'Khong con stock item san sang de giao hang.',
        fulfillmentStatus: FULFILLMENT_STATUSES.FAILED,
      };
    }

    stockItem.status = 'sold';
    await stockItem.save({ transaction });

    await Product.update(
      { quantity: sequelize.literal('GREATEST(quantity - 1, 0)') },
      { where: { id: order.productId }, transaction },
    );

    return {
      ok: true,
      fulfillmentStatus: FULFILLMENT_STATUSES.DELIVERED,
      stockItem,
      stockItemId: stockItem.id,
      deliveryPayload: {
        channel: 'email',
        provider: FULFILLMENT_SOURCES.LOCAL_STOCK,
        deliveryText: stockItem.data,
        stockItemId: stockItem.id,
      },
    };
  },

  async refreshOrderStatus() {
    return {
      ok: true,
      fulfillmentStatus: FULFILLMENT_STATUSES.DELIVERED,
      deliveryPayload: null,
    };
  },
};

const supplierApiProvider = {
  async assertProductReady({ product }) {
    if (!product) {
      throw createMarketplaceError(404, 'San pham khong ton tai.');
    }

    const config = buildProductSourceConfig({
      sourceType: product.sourceType,
      sourceConfig: product.sourceConfig,
    });

    if (normalizeSupplierKind(config.supplierKind) === SUPPLIER_KINDS.DIGITAL_CODE) {
      throw createMarketplaceError(
        409,
        'Nguon digital_code/card duoc de san cho giai doan sau, hien chua kich hoat.',
      );
    }

    assertSmmConfigured();

    if (!config.serviceId) {
      throw createMarketplaceError(400, 'San pham supplier_api chua cau hinh serviceId.');
    }
  },

  async prepareOrderIntent({ product, orderInput }) {
    const config = buildProductSourceConfig({
      sourceType: product.sourceType,
      sourceConfig: product.sourceConfig,
    });

    if (normalizeSupplierKind(config.supplierKind) !== SUPPLIER_KINDS.SMM_PANEL) {
      throw createMarketplaceError(
        409,
        'Nguon supplier hien tai chua ho tro loai nay trong giai doan nay.',
      );
    }

    const quantity = resolveSmmQuantity(config, orderInput);
    const targetLink = resolveSmmTargetLink(config, orderInput);
    const comments = resolveSmmComments(config, orderInput);
    const amount = calculateSmmAmount({
      productPrice: product.price,
      quantity,
      pricingModel: config.pricingModel,
    });

    return {
      amount,
      requestInput: {
        supplierKind: SUPPLIER_KINDS.SMM_PANEL,
        serviceId: config.serviceId,
        quantity,
        targetLink,
        comments,
      },
    };
  },

  async fulfillPaidOrder({ order }) {
    const config = buildProductSourceConfig({
      sourceType: order.fulfillmentSource || order.product?.sourceType || FULFILLMENT_SOURCES.SUPPLIER_API,
      sourceConfig: order.sourceSnapshot?.sourceConfig || order.product?.sourceConfig,
    });
    const requestInput = order.fulfillmentPayload?.requestInput || {};

    if (normalizeSupplierKind(config.supplierKind) !== SUPPLIER_KINDS.SMM_PANEL) {
      return {
        ok: false,
        code: 'provider_not_enabled',
        message: 'Loai supplier nay chua duoc kich hoat.',
        fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
      };
    }

    if (!requestInput.serviceId || !requestInput.quantity || !requestInput.targetLink) {
      return {
        ok: false,
        code: 'invalid_request_input',
        message: 'Thieu request input de tao don supplier.',
        fulfillmentStatus: FULFILLMENT_STATUSES.FAILED,
      };
    }

    let result;
    try {
      result = await createSmmOrder({
        service: requestInput.serviceId,
        link: requestInput.targetLink,
        quantity: requestInput.quantity,
        comments: requestInput.comments,
      });
    } catch (error) {
      if (isSupplierBalanceError(error)) {
        return {
          ok: false,
          code: 'supplier_balance_low',
          message:
            'Vi supplier hien khong du tien de tao don. Don se duoc treo de admin nap them va chay tiep.',
          fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
        };
      }

      throw error;
    }

    if (!result.externalOrderId) {
      return {
        ok: false,
        code: 'external_order_missing',
        message: 'Supplier khong tra ve ma don hang.',
        fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
      };
    }

    return {
      ok: true,
      fulfillmentStatus: FULFILLMENT_STATUSES.PROCESSING,
      deliveryPayload: {
        requestInput,
        externalProvider: SUPPLIER_KINDS.SMM_PANEL,
        externalOrderId: result.externalOrderId,
        externalStatus: 'Pending',
        lastStatusSyncAt: new Date().toISOString(),
        externalRaw: result.raw,
      },
    };
  },

  async refreshOrderStatus({ order }) {
    const payload = order.fulfillmentPayload || {};
    const externalOrderId = sanitizeText(payload.externalOrderId, 80);
    if (!externalOrderId) {
      return {
        ok: false,
        code: 'external_order_missing',
        message: 'Don hang chua co externalOrderId de refresh.',
        fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
      };
    }

    const result = await getSmmOrderStatus(externalOrderId);
    const fulfillmentStatus = mapExternalStatusToFulfillment(result.status);

    return {
      ok: true,
      fulfillmentStatus,
      deliveryPayload: {
        ...payload,
        externalProvider: SUPPLIER_KINDS.SMM_PANEL,
        externalOrderId,
        externalStatus: result.status,
        lastStatusSyncAt: new Date().toISOString(),
        supplierCharge: result.charge,
        supplierStartCount: result.startCount,
        supplierRemains: result.remains,
        externalRaw: result.raw,
      },
    };
  },
};

const providerRegistry = {
  [FULFILLMENT_SOURCES.LOCAL_STOCK]: localStockProvider,
  [FULFILLMENT_SOURCES.SUPPLIER_API]: supplierApiProvider,
};

const getFulfillmentProvider = (sourceType) =>
  providerRegistry[normalizeFulfillmentSource(sourceType)] || localStockProvider;

module.exports = {
  FULFILLMENT_SOURCES,
  SUPPLIER_KINDS,
  SMM_PRICING_MODELS,
  FULFILLMENT_STATUSES,
  normalizeFulfillmentSource,
  normalizeSupplierKind,
  normalizeSmmPricingModel,
  normalizeSourceConfig,
  buildProductSourceConfig,
  buildProductSnapshot,
  buildSourceSnapshot,
  extractDeliveryText,
  normalizeOrderInput,
  getFulfillmentProvider,
  createMarketplaceError,
  isSupplierBalanceError,
};
