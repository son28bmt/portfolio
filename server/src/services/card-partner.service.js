const axios = require('axios');
const crypto = require('crypto');

const sanitizeText = (value, max = 5000) => String(value || '').trim().slice(0, max);
const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const toInt = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : fallback;
};

const md5 = (value) => crypto.createHash('md5').update(String(value || ''), 'utf8').digest('hex');

const getCardPartnerConfig = () => {
  const baseUrl = normalizeUrl(process.env.CARD_PROVIDER_BASE_URL);
  const partnerId = sanitizeText(process.env.CARD_PROVIDER_PARTNER_ID, 80);
  const partnerKey = sanitizeText(process.env.CARD_PROVIDER_PARTNER_KEY, 255);
  const walletNumber = sanitizeText(process.env.CARD_PROVIDER_WALLET_NUMBER, 120);
  const timeoutMs = Math.max(3000, Number(process.env.CARD_PROVIDER_TIMEOUT_MS) || 15000);

  return {
    baseUrl,
    partnerId,
    partnerKey,
    walletNumber,
    timeoutMs,
  };
};

const assertCardPartnerConfigured = () => {
  const config = getCardPartnerConfig();
  if (!config.baseUrl || !config.partnerId || !config.partnerKey || !config.walletNumber) {
    const error = new Error(
      'Thieu cau hinh CARD_PROVIDER_BASE_URL, CARD_PROVIDER_PARTNER_ID, CARD_PROVIDER_PARTNER_KEY hoac CARD_PROVIDER_WALLET_NUMBER.',
    );
    error.status = 500;
    throw error;
  }
  return config;
};

const buildSign = ({ partnerKey, partnerId, command, requestId = '' }) =>
  md5(`${partnerKey}${partnerId}${command}${requestId || ''}`);

const buildParams = (payload = {}) => {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.append(key, String(value));
  });
  return params;
};

const callCardPartner = async ({ command, requestId = '', payload = {}, method = 'post', path = '' }) => {
  const config = assertCardPartnerConfigured();
  const sign = buildSign({
    partnerKey: config.partnerKey,
    partnerId: config.partnerId,
    command,
    requestId,
  });

  const basePayload = {
    partner_id: config.partnerId,
    command,
    ...payload,
  };

  if (requestId !== undefined && requestId !== null && requestId !== '') {
    basePayload.request_id = requestId;
  }

  if (method === 'get') {
    const url = `${config.baseUrl}${path}`;
    const { data } = await axios.get(url, {
      timeout: config.timeoutMs,
      params: {
        partner_id: config.partnerId,
      },
    });
    return data;
  }

  const body = buildParams({
    ...basePayload,
    sign,
  });

  try {
    const { data } = await axios.post(`${config.baseUrl}${path}`, body.toString(), {
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return data;
  } catch (error) {
    const nextError = new Error(
      error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Khong the goi card partner API.',
    );
    nextError.status = error?.response?.status || 502;
    throw nextError;
  }
};

const normalizeCardValueItem = (item, parent = {}) => ({
  providerProductId: item?.id ?? null,
  serviceCode: sanitizeText(item?.service_code || parent?.service_code, 80),
  value: toInt(item?.value),
  providerPrice: toInt(item?.price),
  currencyCode: sanitizeText(item?.currency_code, 20) || 'VND',
  discount: Number(item?.discount || 0),
});

const normalizeCardProduct = (item) => ({
  name: sanitizeText(item?.name, 255),
  slug: sanitizeText(item?.slug, 180),
  serviceCode: sanitizeText(item?.service_code, 80),
  image: sanitizeText(item?.image, 500),
  imgurl: sanitizeText(item?.imgurl, 1000),
  shortDescription: sanitizeText(item?.short_description, 1000),
  description: sanitizeText(item?.description, 10000),
  cardvalue: Array.isArray(item?.cardvalue)
    ? item.cardvalue.map((subItem) => normalizeCardValueItem(subItem, item)).filter((subItem) => subItem.serviceCode && subItem.value > 0)
    : [],
});

const normalizeCardRecord = (item) => ({
  name: sanitizeText(item?.name, 255),
  serial: sanitizeText(item?.serial, 120),
  code: sanitizeText(item?.code, 255),
  expired: item?.expired ? sanitizeText(item.expired, 80) : null,
});

const listCardProducts = async () => {
  const data = await callCardPartner({
    command: 'productlist',
    method: 'get',
    path: '/products',
  });
  return Array.isArray(data) ? data.map(normalizeCardProduct) : [];
};

const getCardBalance = async () => {
  const config = assertCardPartnerConfigured();
  const data = await callCardPartner({
    command: 'getbalance',
    payload: {
      wallet_number: config.walletNumber,
    },
  });

  return {
    balance: toInt(data?.balance),
    currency: sanitizeText(data?.currency_code || data?.currency, 20) || 'VND',
    raw: data,
  };
};

const checkCardAvailable = async ({ serviceCode, value, qty = 1 }) => {
  const data = await callCardPartner({
    command: 'checkavailable',
    payload: {
      service_code: serviceCode,
      value,
      qty,
    },
  });

  return {
    stockAvailable: Boolean(data?.stock_available),
    message: sanitizeText(data?.message, 255),
    raw: data,
  };
};

const buyCard = async ({ requestId, serviceCode, value, qty = 1 }) => {
  const config = assertCardPartnerConfigured();
  const data = await callCardPartner({
    command: 'buycard',
    requestId,
    payload: {
      service_code: serviceCode,
      wallet_number: config.walletNumber,
      value,
      qty,
    },
  });

  return {
    status: toInt(data?.status),
    message: sanitizeText(data?.message, 255),
    orderCode: sanitizeText(data?.data?.order_code, 120),
    requestId: sanitizeText(data?.data?.request_id || requestId, 120),
    cards: Array.isArray(data?.data?.cards) ? data.data.cards.map(normalizeCardRecord) : [],
    raw: data,
  };
};

const redownloadCard = async ({ requestId, orderCode }) => {
  const data = await callCardPartner({
    command: 'redownload',
    requestId,
    payload: {
      order_code: orderCode,
    },
  });

  return {
    status: toInt(data?.status),
    message: sanitizeText(data?.message, 255),
    orderCode: sanitizeText(data?.data?.order_code || orderCode, 120),
    requestId: sanitizeText(data?.data?.request_id || requestId, 120),
    cards: Array.isArray(data?.data?.cards) ? data.data.cards.map(normalizeCardRecord) : [],
    raw: data,
  };
};

module.exports = {
  getCardPartnerConfig,
  assertCardPartnerConfigured,
  listCardProducts,
  getCardBalance,
  checkCardAvailable,
  buyCard,
  redownloadCard,
};
