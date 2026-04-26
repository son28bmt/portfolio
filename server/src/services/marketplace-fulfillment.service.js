const { sequelize } = require('../config/db');
const { Product, StockItem } = require('../models');
const {
  assertSmmConfigured,
  createSmmOrder,
  getSmmOrderStatus,
} = require('./smm-panel.service');
const {
  assertCardPartnerConfigured,
  checkCardAvailable,
  buyCard,
  redownloadCard,
} = require('./card-partner.service');

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
  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    const looksLikeIndexedStringObject =
      entries.length > 0 &&
      entries.every(([key, item]) => /^\d+$/.test(key) && typeof item === 'string');

    if (looksLikeIndexedStringObject) {
      const reconstructed = entries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, item]) => item)
        .join('');

      try {
        const parsed = JSON.parse(reconstructed);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }

    return { ...value };
  }
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
      serviceCode: sanitizeText(normalizedConfig.serviceCode, 80) || null,
      cardValue: toInt(normalizedConfig.cardValue),
      currencyCode: sanitizeText(normalizedConfig.currencyCode, 20) || 'VND',
      productSlug: sanitizeText(normalizedConfig.productSlug, 180) || null,
      imageUrl: sanitizeText(normalizedConfig.imageUrl, 1000) || null,
      serviceName: sanitizeText(normalizedConfig.serviceName, 255) || '',
      categoryName: sanitizeText(normalizedConfig.categoryName, 255) || '',
      defaultQuantity: Math.max(1, toInt(normalizedConfig.defaultQuantity) || 1),
      allowsQuantity: Boolean(normalizedConfig.allowsQuantity),
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
    targetLabel: sanitizeText(normalizedConfig.targetLabel, 120) || 'Link muc tieu',
    commentsLabel: sanitizeText(normalizedConfig.commentsLabel, 120) || 'Noi dung comments',
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

const buildCardDeliveryText = ({ cards = [], orderCode = '', serviceName = '', value = 0 }) => {
  const lines = [
    sanitizeText(serviceName, 255) || 'Ma the / card',
    orderCode ? `Ma don nha cung cap: ${orderCode}` : '',
    value ? `Menh gia: ${Number(value).toLocaleString('vi-VN')} d` : '',
    '',
  ].filter(Boolean);

  cards.forEach((card, index) => {
    lines.push(`The ${index + 1}:`);
    lines.push(`- Ten: ${sanitizeText(card?.name, 255) || 'Card'}`);
    lines.push(`- Serial: ${sanitizeText(card?.serial, 255)}`);
    lines.push(`- Code: ${sanitizeText(card?.code, 255)}`);
    if (card?.expired) lines.push(`- Het han: ${sanitizeText(card.expired, 80)}`);
    lines.push('');
  });

  return lines.join('\n').trim();
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

const resolveCardQuantity = (config, orderInput) => {
  const requestedQuantity = toInt(orderInput?.quantity);
  const defaultQuantity = Math.max(1, toInt(config.defaultQuantity) || 1);
  if (config.allowsQuantity) {
    return Math.max(1, requestedQuantity || defaultQuantity);
  }
  return 1;
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

const mapCardProviderFailure = ({ status, message }) => {
  const normalizedStatus = Number(status || 0);
  const cleanMessage = sanitizeText(message, 255) || 'Khong the mua the.';

  if (normalizedStatus === 2) {
    return {
      code: 'card_redownload_required',
      message: 'Thanh toan thanh cong nhung chua lay duoc the. He thong se thu tai lai sau.',
      fulfillmentStatus: FULFILLMENT_STATUSES.PROCESSING,
    };
  }

  if (normalizedStatus === 102) {
    return {
      code: 'supplier_balance_low',
      message:
        'Vi supplier hien khong du tien de mua the. Don se duoc treo de admin nap them va chay tiep.',
      fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
    };
  }

  if ([109, 114, 116, 118, 121, 122, 123, 124].includes(normalizedStatus)) {
    return {
      code:
        normalizedStatus === 118
          ? 'out_of_stock'
          : normalizedStatus === 109
            ? 'duplicate_request'
            : 'card_provider_manual_review',
      message: cleanMessage,
      fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
    };
  }

  return {
    code: normalizedStatus ? `card_error_${normalizedStatus}` : 'card_provider_failed',
    message: cleanMessage,
    fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
  };
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
      assertCardPartnerConfigured();
      if (!config.serviceCode || !config.cardValue) {
        throw createMarketplaceError(400, 'San pham card chua cau hinh serviceCode hoac cardValue.');
      }

      const availability = await checkCardAvailable({
        serviceCode: config.serviceCode,
        value: config.cardValue,
        qty: resolveCardQuantity(config, {}),
      });

      if (!availability.stockAvailable) {
        throw createMarketplaceError(
          409,
          availability.message || 'San pham card tam thoi het hang hoac khong du ton kho.',
        );
      }
      return;
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

    if (normalizeSupplierKind(config.supplierKind) === SUPPLIER_KINDS.DIGITAL_CODE) {
      const quantity = resolveCardQuantity(config, orderInput);
      const amount = Math.round(Number(product?.price || 0) * quantity);
      if (!amount || amount <= 0) {
        throw createMarketplaceError(400, 'San pham card chua co gia hop le.');
      }

      return {
        amount,
        requestInput: {
          supplierKind: SUPPLIER_KINDS.DIGITAL_CODE,
          serviceCode: config.serviceCode,
          cardValue: config.cardValue,
          qty: quantity,
        },
      };
    }

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

    if (normalizeSupplierKind(config.supplierKind) === SUPPLIER_KINDS.DIGITAL_CODE) {
      const quantity = resolveCardQuantity(config, { quantity: requestInput.qty });

      const availability = await checkCardAvailable({
        serviceCode: config.serviceCode,
        value: config.cardValue,
        qty: quantity,
      });

      if (!availability.stockAvailable) {
        return {
          ok: false,
          code: 'out_of_stock',
          message: availability.message || 'San pham card da het hang.',
          fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
        };
      }

      const result = await buyCard({
        requestId: order.payment_ref,
        serviceCode: requestInput.serviceCode || config.serviceCode,
        value: requestInput.cardValue || config.cardValue,
        qty: quantity,
      });

      if (result.status === 1 && result.cards.length > 0) {
        return {
          ok: true,
          fulfillmentStatus: FULFILLMENT_STATUSES.DELIVERED,
          deliveryPayload: {
            requestInput,
            externalProvider: 'card_partner',
            externalOrderId: result.orderCode,
            externalStatus: 'completed',
            lastStatusSyncAt: new Date().toISOString(),
            cards: result.cards,
            deliveryText: buildCardDeliveryText({
              cards: result.cards,
              orderCode: result.orderCode,
              serviceName: config.serviceName,
              value: config.cardValue,
            }),
            externalRaw: result.raw,
          },
        };
      }

      if (result.status === 2 && result.orderCode) {
        return {
          ok: true,
          fulfillmentStatus: FULFILLMENT_STATUSES.PROCESSING,
          deliveryPayload: {
            requestInput,
            externalProvider: 'card_partner',
            externalOrderId: result.orderCode,
            externalStatus: 'pending',
            lifecycle: 'awaiting_redownload',
            lastStatusSyncAt: new Date().toISOString(),
            externalRaw: result.raw,
          },
        };
      }

      return {
        ok: false,
        ...mapCardProviderFailure({ status: result.status, message: result.message }),
      };
    }

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
    const config = buildProductSourceConfig({
      sourceType:
        order.fulfillmentSource || order.product?.sourceType || FULFILLMENT_SOURCES.SUPPLIER_API,
      sourceConfig: order.sourceSnapshot?.sourceConfig || order.product?.sourceConfig,
    });
    const payload = order.fulfillmentPayload || {};
    const externalOrderId = sanitizeText(payload.externalOrderId, 80);
    if (normalizeSupplierKind(config.supplierKind) === SUPPLIER_KINDS.DIGITAL_CODE) {
      if (!externalOrderId) {
        return {
          ok: false,
          code: 'external_order_missing',
          message: 'Don hang card chua co externalOrderId de tai lai the.',
          fulfillmentStatus: FULFILLMENT_STATUSES.MANUAL_REVIEW,
        };
      }

      const result = await redownloadCard({
        requestId: order.payment_ref,
        orderCode: externalOrderId,
      });

      if (result.status === 1 && result.cards.length > 0) {
        return {
          ok: true,
          fulfillmentStatus: FULFILLMENT_STATUSES.DELIVERED,
          deliveryPayload: {
            ...payload,
            externalProvider: 'card_partner',
            externalOrderId,
            externalStatus: 'completed',
            lastStatusSyncAt: new Date().toISOString(),
            cards: result.cards,
            deliveryText: buildCardDeliveryText({
              cards: result.cards,
              orderCode: externalOrderId,
              serviceName: config.serviceName,
              value: config.cardValue,
            }),
            externalRaw: result.raw,
          },
        };
      }

      if (result.status === 2) {
        return {
          ok: true,
          fulfillmentStatus: FULFILLMENT_STATUSES.PROCESSING,
          deliveryPayload: {
            ...payload,
            externalProvider: 'card_partner',
            externalOrderId,
            externalStatus: 'pending',
            lifecycle: 'awaiting_redownload',
            lastStatusSyncAt: new Date().toISOString(),
            externalRaw: result.raw,
          },
        };
      }

      return {
        ok: false,
        ...mapCardProviderFailure({ status: result.status, message: result.message }),
      };
    }

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
