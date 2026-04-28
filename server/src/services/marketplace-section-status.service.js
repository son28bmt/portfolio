const Setting = require('../models/Setting');
const { normalizeSourceConfig } = require('./marketplace-fulfillment.service');

const SETTING_KEY = 'marketplace_section_status';

const SECTION_KEYS = Object.freeze({
  SERVICE: 'service',
  CARD: 'card',
  CUSTOM: 'custom',
});

const DEFAULT_SECTION_STATUS = Object.freeze({
  [SECTION_KEYS.SERVICE]: {
    enabled: true,
    message: 'Khu dịch vụ số đang bảo trì. Vui lòng quay lại sau.',
  },
  [SECTION_KEYS.CARD]: {
    enabled: true,
    message: 'Khu card và mã số đang bảo trì. Vui lòng quay lại sau.',
  },
  [SECTION_KEYS.CUSTOM]: {
    enabled: true,
    message: 'Khu Account & key đang bảo trì. Vui lòng quay lại sau.',
  },
});

const normalizeSectionKey = (value) => {
  const clean = String(value || '').trim().toLowerCase();
  if (Object.values(SECTION_KEYS).includes(clean)) return clean;
  return SECTION_KEYS.SERVICE;
};

const normalizeSectionStatus = (value = {}) => {
  const normalized = {};

  Object.entries(DEFAULT_SECTION_STATUS).forEach(([key, fallback]) => {
    const item = value && typeof value === 'object' ? value[key] : null;
    normalized[key] = {
      enabled: item?.enabled !== false,
      message: String(item?.message || fallback.message).trim() || fallback.message,
    };
  });

  return normalized;
};

const getMarketplaceSectionStatus = async () => {
  try {
    const setting = await Setting.findOne({ where: { key: SETTING_KEY } });
    if (!setting?.value) return normalizeSectionStatus();

    const parsed = JSON.parse(setting.value);
    return normalizeSectionStatus(parsed);
  } catch (error) {
    console.error('[Marketplace] Cannot read section status:', error.message);
    return normalizeSectionStatus();
  }
};

const saveMarketplaceSectionStatus = async (input = {}) => {
  const nextStatus = normalizeSectionStatus(input);
  const value = JSON.stringify(nextStatus);

  const [setting] = await Setting.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: { value },
  });

  if (setting.value !== value) {
    setting.value = value;
    await setting.save();
  }

  return nextStatus;
};

const resolveSectionKeyForProduct = (product) => {
  const sourceType = String(product?.sourceType || '').trim().toLowerCase();
  const sourceConfig = normalizeSourceConfig(product?.sourceConfig);
  const supplierKind = String(sourceConfig?.supplierKind || '').trim().toLowerCase();

  if (sourceType === 'supplier_api' && supplierKind === 'digital_code') {
    return SECTION_KEYS.CARD;
  }

  if (sourceType === 'supplier_api') {
    return SECTION_KEYS.SERVICE;
  }

  return SECTION_KEYS.CUSTOM;
};

const assertMarketplaceSectionOpenForProduct = async (product) => {
  const sectionKey = resolveSectionKeyForProduct(product);
  const status = await getMarketplaceSectionStatus();
  const section = status[sectionKey] || DEFAULT_SECTION_STATUS[sectionKey];

  if (section?.enabled === false) {
    const error = new Error(section.message || 'Khu này đang bảo trì. Vui lòng quay lại sau.');
    error.status = 503;
    error.sectionKey = sectionKey;
    throw error;
  }
};

module.exports = {
  SECTION_KEYS,
  DEFAULT_SECTION_STATUS,
  normalizeSectionKey,
  getMarketplaceSectionStatus,
  saveMarketplaceSectionStatus,
  resolveSectionKeyForProduct,
  assertMarketplaceSectionOpenForProduct,
};
