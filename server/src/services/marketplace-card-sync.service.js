const { Category, Product } = require('../models');
const { ensureMarketplaceSchema } = require('./marketplace-schema.service');
const { notifyAdmin } = require('./socket.service');
const {
  FULFILLMENT_SOURCES,
  SUPPLIER_KINDS,
  buildProductSourceConfig,
} = require('./marketplace-fulfillment.service');
const { listCardProducts } = require('./card-partner.service');

const sanitizeText = (value, max = 255) => String(value || '').trim().slice(0, max);

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeSyncOptions = (input = {}) => ({
  rateMultiplier: Math.max(0, Number(input.rateMultiplier || 1)),
  markupPercent: toNumber(input.markupPercent, 0),
  markupFixed: toNumber(input.markupFixed, 0),
  updateExisting: input.updateExisting !== false,
  onlyCreate: Boolean(input.onlyCreate),
});

const computeLocalPrice = (value, options) => {
  const cost = Math.max(0, Number(value || 0)) * options.rateMultiplier;
  const withPercent = cost * (1 + options.markupPercent / 100);
  return Math.max(0, Math.round(withPercent + options.markupFixed));
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
  const normalizedName = sanitizeText(name, 255) || 'Card';
  const key = normalizedName.toLowerCase();
  if (categoryMap.has(key)) return categoryMap.get(key);

  const category = await Category.create({ name: normalizedName, storeSection: 'card' });
  categoryMap.set(key, category);
  return category;
};

const getExistingCardMap = async () => {
  const products = await Product.findAll({
    where: { sourceType: FULFILLMENT_SOURCES.SUPPLIER_API },
  });

  const map = new Map();
  products.forEach((product) => {
    const config = product?.sourceConfig || {};
    if (String(config?.supplierKind || '').toLowerCase() !== SUPPLIER_KINDS.DIGITAL_CODE) return;
    const key = `${sanitizeText(config.serviceCode, 80).toLowerCase()}:${Number(config.cardValue || 0)}`;
    if (key !== ':0') {
      map.set(key, product);
    }
  });
  return map;
};

const syncCardCatalogToMarketplace = async (input = {}) => {
  await ensureMarketplaceSchema();

  const options = normalizeSyncOptions(input);
  const cardProducts = await listCardProducts();
  const categoryMap = await getCategoryMap();
  const existingMap = await getExistingCardMap();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const items = [];

  for (const providerProduct of cardProducts) {
    const category = await ensureCategory(providerProduct.name, categoryMap);

    for (const valueItem of providerProduct.cardvalue) {
      const key = `${sanitizeText(valueItem.serviceCode, 80).toLowerCase()}:${Number(valueItem.value || 0)}`;
      const existingProduct = existingMap.get(key) || null;

      const payload = {
        name: `${providerProduct.name} ${Number(valueItem.value || 0).toLocaleString('vi-VN')}d`,
        description:
          providerProduct.description ||
          providerProduct.shortDescription ||
          `${providerProduct.name} ${Number(valueItem.value || 0).toLocaleString('vi-VN')}d`,
        price: computeLocalPrice(valueItem.providerPrice || valueItem.value, options),
        categoryId: category.id,
        quantity: 0,
        sourceType: FULFILLMENT_SOURCES.SUPPLIER_API,
        sourceConfig: buildProductSourceConfig({
          sourceType: FULFILLMENT_SOURCES.SUPPLIER_API,
          sourceConfig: {
            supplierKind: SUPPLIER_KINDS.DIGITAL_CODE,
            providerCode: 'card_partner',
            cardProviderCode: 'card_partner',
            cardSku: valueItem.providerProductId,
            supplierProductId: valueItem.providerProductId,
            serviceCode: valueItem.serviceCode,
            cardValue: valueItem.value,
            currencyCode: valueItem.currencyCode,
            productSlug: providerProduct.slug,
            imageUrl: providerProduct.imgurl || providerProduct.image || '',
            serviceName: providerProduct.name,
            categoryName: category.name,
            defaultQuantity: 1,
            allowsQuantity: false,
          },
        }),
      };

      if (!existingProduct) {
        const createdProduct = await Product.create(payload);
        existingMap.set(key, createdProduct);
        created += 1;
        items.push({
          mode: 'created',
          productId: createdProduct.id,
          serviceCode: valueItem.serviceCode,
          value: valueItem.value,
          name: createdProduct.name,
        });
        continue;
      }

      if (options.onlyCreate || !options.updateExisting) {
        skipped += 1;
        items.push({
          mode: 'skipped',
          productId: existingProduct.id,
          serviceCode: valueItem.serviceCode,
          value: valueItem.value,
          name: existingProduct.name,
        });
        continue;
      }

      await existingProduct.update(payload);
      updated += 1;
      items.push({
        mode: 'updated',
        productId: existingProduct.id,
        serviceCode: valueItem.serviceCode,
        value: valueItem.value,
        name: payload.name,
      });
    }
  }

  notifyAdmin('admin_market_refresh');

  return {
    fetched: cardProducts.length,
    created,
    updated,
    skipped,
    items,
  };
};

module.exports = {
  syncCardCatalogToMarketplace,
};
