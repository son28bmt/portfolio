const { Category, Order, Product } = require('../models');
const { ensureMarketplaceSchema } = require('./marketplace-schema.service');
const { sendEvent } = require('./sse.service');
const { notifyAdmin } = require('./socket.service');
const { notifyTelegramOrderStatus } = require('./telegram.service');
const {
  FULFILLMENT_SOURCES,
  FULFILLMENT_STATUSES,
  SUPPLIER_KINDS,
  normalizeFulfillmentSource,
  normalizeSmmPricingModel,
  buildProductSourceConfig,
  getFulfillmentProvider,
} = require('./marketplace-fulfillment.service');
const { listSmmServices } = require('./smm-panel.service');

const sanitizeText = (value, max = 255) => String(value || '').trim().slice(0, max);

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toPositiveNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};

const normalizeSyncOptions = (input = {}) => {
  const rawIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const serviceIds = Array.from(
    new Set(
      rawIds
        .map((item) => sanitizeText(item, 80))
        .filter(Boolean),
    ),
  );

  return {
    serviceIds,
    pricingModel: normalizeSmmPricingModel(input.pricingModel),
    rateMultiplier: toPositiveNumber(input.rateMultiplier, 1),
    markupPercent: toNumber(input.markupPercent, 0),
    markupFixed: toNumber(input.markupFixed, 0),
    updateExisting: input.updateExisting !== false,
    onlyCreate: Boolean(input.onlyCreate),
  };
};

const buildSmmDescription = (service) => {
  const parts = [
    sanitizeText(service.name, 255),
    `Service ID: ${sanitizeText(service.service, 80)}`,
    `Category: ${sanitizeText(service.category, 255) || 'SMM Panel'}`,
  ];

  if (service.type) parts.push(`Type: ${sanitizeText(service.type, 120)}`);
  if (Number.isFinite(Number(service.min)) || Number.isFinite(Number(service.max))) {
    parts.push(`Range: ${Number(service.min || 0)} - ${Number(service.max || 0)}`);
  }
  parts.push(`Refill: ${service.refill ? 'yes' : 'no'}`);
  parts.push(`Cancel: ${service.cancel ? 'yes' : 'no'}`);

  return parts.join('\n');
};

const computeLocalPrice = (service, options) => {
  const supplierRate = toPositiveNumber(service.rate, 0);
  const convertedRate = supplierRate * options.rateMultiplier;
  const withPercent = convertedRate * (1 + options.markupPercent / 100);
  const withFixed = withPercent + options.markupFixed;
  return Math.max(0, Math.round(withFixed));
};

const buildSyncedSourceConfig = ({ service, existingProduct, options }) => {
  const existingConfig =
    existingProduct?.sourceConfig && typeof existingProduct.sourceConfig === 'object'
      ? existingProduct.sourceConfig
      : {};

  return buildProductSourceConfig({
    sourceType: FULFILLMENT_SOURCES.SUPPLIER_API,
    sourceConfig: {
      ...existingConfig,
      supplierKind: SUPPLIER_KINDS.SMM_PANEL,
      serviceId: sanitizeText(service.service, 80),
      pricingModel: options.pricingModel,
      minQuantity: Number(service.min || 0) || null,
      maxQuantity: Number(service.max || 0) || null,
      defaultQuantity:
        toPositiveNumber(existingConfig.defaultQuantity, 0) ||
        toPositiveNumber(service.min, 0) ||
        null,
      requiresTargetLink: existingConfig.requiresTargetLink !== false,
      requiresComments: Boolean(existingConfig.requiresComments),
      targetLabel: sanitizeText(existingConfig.targetLabel, 120) || 'Link muc tieu',
      commentsLabel: sanitizeText(existingConfig.commentsLabel, 120) || 'Noi dung comments',
      serviceName: sanitizeText(service.name, 255),
      categoryName: sanitizeText(service.category, 255),
      providerCode: 'smm_panel',
      supplierRate: Number(service.rate || 0),
      supplierType: sanitizeText(service.type, 80),
      refill: Boolean(service.refill),
      cancel: Boolean(service.cancel),
      lastCatalogSyncAt: new Date().toISOString(),
    },
  });
};

const getExistingSupplierMap = async () => {
  const products = await Product.findAll({
    where: { sourceType: FULFILLMENT_SOURCES.SUPPLIER_API },
  });

  const map = new Map();
  products.forEach((product) => {
    const serviceId = sanitizeText(product?.sourceConfig?.serviceId, 80);
    if (serviceId) map.set(serviceId, product);
  });
  return map;
};

const getCategoryMap = async () => {
  const rows = await Category.findAll();
  const map = new Map();
  rows.forEach((category) => {
    map.set(String(category.name || '').trim().toLowerCase(), category);
  });
  return map;
};

const ensureCategory = async (name, categoryMap) => {
  const normalizedName = sanitizeText(name, 255) || 'SMM Panel';
  const key = normalizedName.toLowerCase();
  if (categoryMap.has(key)) return categoryMap.get(key);

  const category = await Category.create({ name: normalizedName, storeSection: 'service' });
  categoryMap.set(key, category);
  return category;
};

const syncSmmPanelServicesToCatalog = async (input = {}) => {
  await ensureMarketplaceSchema();

  const options = normalizeSyncOptions(input);
  const allServices = await listSmmServices();
  const selectedServices =
    options.serviceIds.length > 0
      ? allServices.filter((item) => options.serviceIds.includes(sanitizeText(item.service, 80)))
      : allServices;

  if (selectedServices.length === 0) {
    return {
      fetched: allServices.length,
      selected: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      items: [],
    };
  }

  const existingSupplierMap = await getExistingSupplierMap();
  const categoryMap = await getCategoryMap();

  const items = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const service of selectedServices) {
    const serviceId = sanitizeText(service.service, 80);
    if (!serviceId) {
      skipped += 1;
      continue;
    }

    const category = await ensureCategory(service.category, categoryMap);
    const existingProduct = existingSupplierMap.get(serviceId) || null;
    const sourceConfig = buildSyncedSourceConfig({
      service,
      existingProduct,
      options,
    });

    const payload = {
      name: sanitizeText(service.name, 255) || `SMM Service ${serviceId}`,
      description: buildSmmDescription(service),
      price: computeLocalPrice(service, options),
      categoryId: category.id,
      quantity: existingProduct ? existingProduct.quantity : 0,
      sourceType: FULFILLMENT_SOURCES.SUPPLIER_API,
      sourceConfig,
    };

    if (!existingProduct) {
      const createdProduct = await Product.create(payload);
      existingSupplierMap.set(serviceId, createdProduct);
      created += 1;
      items.push({
        mode: 'created',
        productId: createdProduct.id,
        serviceId,
        name: createdProduct.name,
      });
      continue;
    }

    if (options.onlyCreate || !options.updateExisting) {
      skipped += 1;
      items.push({
        mode: 'skipped',
        productId: existingProduct.id,
        serviceId,
        name: existingProduct.name,
      });
      continue;
    }

    await existingProduct.update(payload);
    updated += 1;
    items.push({
      mode: 'updated',
      productId: existingProduct.id,
      serviceId,
      name: payload.name,
    });
  }

  notifyAdmin('admin_market_refresh');

  return {
    fetched: allServices.length,
    selected: selectedServices.length,
    created,
    updated,
    skipped,
    items,
  };
};

const isDueForStatusRefresh = (order, minAgeMs) => {
  const lastSyncAt = order?.fulfillmentPayload?.lastStatusSyncAt;
  if (!lastSyncAt) return true;

  const lastSyncMs = Date.parse(lastSyncAt);
  if (!Number.isFinite(lastSyncMs)) return true;
  return Date.now() - lastSyncMs >= minAgeMs;
};

const applySupplierStatusRefresh = async (order, { emitEvents = true } = {}) => {
  const sourceType = normalizeFulfillmentSource(
    order?.fulfillmentSource || order?.product?.sourceType,
  );
  if (sourceType !== FULFILLMENT_SOURCES.SUPPLIER_API) {
    const error = new Error('Chi refresh duoc don supplier_api.');
    error.status = 400;
    throw error;
  }

  const provider = getFulfillmentProvider(sourceType);
  const previousFulfillmentStatus = sanitizeText(order.fulfillmentStatus, 40);
  const previousExternalStatus = sanitizeText(order?.fulfillmentPayload?.externalStatus, 80);

  let result;
  try {
    result = await provider.refreshOrderStatus({ order });
  } catch (error) {
    order.fulfillmentPayload = {
      ...(order.fulfillmentPayload || {}),
      lastSyncError: error.message || 'Khong the dong bo trang thai supplier.',
      lastSyncErrorAt: new Date().toISOString(),
    };
    await order.save();
    throw error;
  }

  order.fulfillmentStatus =
    result?.fulfillmentStatus || order.fulfillmentStatus || FULFILLMENT_STATUSES.MANUAL_REVIEW;
  order.fulfillmentPayload = result?.deliveryPayload || order.fulfillmentPayload || null;
  await order.save();

  const nextExternalStatus = sanitizeText(order?.fulfillmentPayload?.externalStatus, 80);
  const changed =
    previousFulfillmentStatus !== sanitizeText(order.fulfillmentStatus, 40) ||
    previousExternalStatus !== nextExternalStatus;

  if (emitEvents && changed) {
    sendEvent('market', order.payment_ref, {
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
    });
    notifyAdmin('admin_market_refresh');
    if (order.fulfillmentStatus === FULFILLMENT_STATUSES.DELIVERED) {
      notifyTelegramOrderStatus({
        order,
        product: order.product,
        title: '[ORDER] Don hang da hoan thanh',
        message: 'Supplier da cap nhat trang thai delivered.',
      });
    }
  }

  return {
    order,
    changed,
    result,
  };
};

const autoRefreshSupplierOrdersBatch = async (input = {}) => {
  await ensureMarketplaceSchema();

  const limit = Math.max(1, Math.min(50, Number(input.limit) || 10));
  const minAgeMs = Math.max(10000, Number(input.minAgeMs) || 60000);
  const queryLimit = Math.max(limit * 5, limit);

  const rows = await Order.findAll({
    where: {
      status: 'paid',
      fulfillmentStatus: FULFILLMENT_STATUSES.PROCESSING,
      fulfillmentSource: FULFILLMENT_SOURCES.SUPPLIER_API,
    },
    include: [{ model: Product, as: 'product' }],
    order: [['id', 'ASC']],
    limit: queryLimit,
  });

  const dueOrders = rows.filter((item) => isDueForStatusRefresh(item, minAgeMs)).slice(0, limit);
  const summary = {
    scanned: rows.length,
    due: dueOrders.length,
    changed: 0,
    delivered: 0,
    manualReview: 0,
    failed: 0,
    errors: 0,
  };

  for (const order of dueOrders) {
    try {
      const { order: refreshedOrder, changed } = await applySupplierStatusRefresh(order);
      if (changed) summary.changed += 1;
      if (refreshedOrder.fulfillmentStatus === FULFILLMENT_STATUSES.DELIVERED) {
        summary.delivered += 1;
      }
      if (refreshedOrder.fulfillmentStatus === FULFILLMENT_STATUSES.MANUAL_REVIEW) {
        summary.manualReview += 1;
      }
      if (refreshedOrder.fulfillmentStatus === FULFILLMENT_STATUSES.FAILED) {
        summary.failed += 1;
      }
    } catch (error) {
      summary.errors += 1;
      console.error('[Marketplace] Supplier auto refresh failed:', error.message);
    }
  }

  return summary;
};

let schedulerTimer = null;
let schedulerRunning = false;

const startMarketplaceSupplierScheduler = () => {
  if (schedulerTimer) return schedulerTimer;

  const enabled = String(process.env.MARKET_SUPPLIER_SYNC_ENABLED || 'true') !== 'false';
  if (!enabled) {
    console.log('[Marketplace] Supplier scheduler disabled.');
    return null;
  }

  const intervalMs = Math.max(
    15000,
    Number(process.env.MARKET_SUPPLIER_SYNC_INTERVAL_MS) || 60000,
  );
  const batchSize = Math.max(
    1,
    Math.min(50, Number(process.env.MARKET_SUPPLIER_SYNC_BATCH_SIZE) || 10),
  );
  const minAgeMs = Math.max(
    10000,
    Number(process.env.MARKET_SUPPLIER_MIN_SYNC_AGE_MS) || 60000,
  );

  const run = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const summary = await autoRefreshSupplierOrdersBatch({
        limit: batchSize,
        minAgeMs,
      });
      if (summary.changed || summary.errors) {
        console.log('[Marketplace] Supplier scheduler summary:', summary);
      }
    } catch (error) {
      console.error('[Marketplace] Supplier scheduler crashed:', error.message);
    } finally {
      schedulerRunning = false;
    }
  };

  schedulerTimer = setInterval(run, intervalMs);
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
  setTimeout(run, Math.min(intervalMs, 15000));

  console.log(
    `[Marketplace] Supplier scheduler started. interval=${intervalMs}ms batch=${batchSize} minAge=${minAgeMs}ms`,
  );

  return schedulerTimer;
};

module.exports = {
  syncSmmPanelServicesToCatalog,
  applySupplierStatusRefresh,
  autoRefreshSupplierOrdersBatch,
  startMarketplaceSupplierScheduler,
};
