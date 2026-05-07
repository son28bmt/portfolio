const axios = require('axios');
const crypto = require('crypto');

const sanitizeText = (value, max = 5000) => String(value || '').trim().slice(0, max);
const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const toInt = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : fallback;
};

const md5 = (value) => crypto.createHash('md5').update(String(value || ''), 'utf8').digest('hex');

const getCardPartnerConfig = (kind = 'card') => {
  let baseUrl = normalizeUrl(process.env.CARD_PROVIDER_BASE_URL);
  const timeoutMs = Math.max(3000, Number(process.env.CARD_PROVIDER_TIMEOUT_MS) || 15000);
  const walletNumber = sanitizeText(process.env.CARD_PROVIDER_WALLET_NUMBER, 120);

  let partnerId = sanitizeText(process.env.CARD_PROVIDER_PARTNER_ID, 80);
  let partnerKey = sanitizeText(process.env.CARD_PROVIDER_PARTNER_KEY, 255);

  if (kind === 'topup') {
    const topupUrl = normalizeUrl(process.env.TOPUP_PROVIDER_BASE_URL);
    if (topupUrl) baseUrl = topupUrl;

    const topupId = sanitizeText(process.env.TOPUP_PROVIDER_PARTNER_ID, 80);
    const topupKey = sanitizeText(process.env.TOPUP_PROVIDER_PARTNER_KEY, 255);
    if (topupId) partnerId = topupId;
    if (topupKey) partnerKey = topupKey;
  }

  return {
    baseUrl,
    partnerId,
    partnerKey,
    walletNumber,
    timeoutMs,
  };
};

const assertCardPartnerConfigured = (kind = 'card') => {
  const config = getCardPartnerConfig(kind);
  if (!config.baseUrl || !config.partnerId || !config.partnerKey) {
    const nextError = new Error(`Card partner provider (${kind}) is not fully configured in environment variables.`);
    nextError.status = 500;
    throw nextError;
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

const CARD_PROVIDER_STATUS_MESSAGES = {
  102: 'So du nha cung cap khong du.',
  109: 'Request id bi trung.',
  114: 'IP server chua duoc dang ky/whitelist voi nha cung cap.',
  116: 'Sai chu ky nha cung cap.',
  118: 'San pham nha cung cap da het hang.',
  121: 'Sai hoac thieu service_code.',
  122: 'Sai hoac thieu menh gia.',
  123: 'Sai hoac thieu so luong.',
  124: 'Tai khoan nha cung cap chua duoc phe duyet hoac bi khoa.',
};

const getProviderStatusMessage = (status, fallback = '') => {
  const code = Number(status || 0);
  return sanitizeText(fallback, 500) || CARD_PROVIDER_STATUS_MESSAGES[code] || `Nha cung cap tra ve status ${code}.`;
};

const assertSuccessfulProviderResponse = (data, { command, kind }) => {
  if (!data || Array.isArray(data)) return;

  const status = Number(data.status || 0);
  if (!status || status === 1) return;

  const error = new Error(getProviderStatusMessage(data.status, data.message || data.error));
  error.status = 502;
  error.providerStatus = status;
  error.providerKind = kind;
  error.providerCommand = command;
  error.providerRaw = data;
  throw error;
};

const callCardPartner = async ({ command, requestId = '', payload = {}, method = 'post', path = '', useJson = false, kind = 'card' }) => {
  const config = assertCardPartnerConfigured(kind);
  
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

  const url = `${config.baseUrl}${path}`;

  if (method === 'get') {
    const { data } = await axios.get(url, {
      timeout: config.timeoutMs,
      params: {
        partner_id: config.partnerId,
      },
    });
    return data;
  }

  const body = useJson 
    ? { ...basePayload, sign }
    : buildParams({ ...basePayload, sign });

  try {
    const { data } = await axios.post(url, useJson ? body : body.toString(), {
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': useJson ? 'application/json' : 'application/x-www-form-urlencoded',
      },
    });
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CARD PARTNER DEBUG] (${kind}) URL: ${url}`);
      console.log(`[CARD PARTNER DEBUG] (${kind}) Response:`, JSON.stringify(data).slice(0, 500));
    }
    
    return data;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[CARD PARTNER ERROR] (${kind}) URL: ${url}`);
      console.error(`[CARD PARTNER ERROR] (${kind}) Status: ${error?.response?.status}`);
      console.error(`[CARD PARTNER ERROR] (${kind}) Data:`, JSON.stringify(error?.response?.data));
    }
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

const topup = async ({ requestId, serviceCode, amount, phone, qty = 1 }) => {
  const data = await callCardPartner({
    kind: 'topup',
    command: 'topup',
    requestId,
    path: '',
    useJson: true,
    payload: {
      service_code: serviceCode,
      amount: String(amount),
      qty: String(qty),
      account_info: {
        phone: phone,
      },
    },
  });

  return {
    status: data?.status,
    message: data?.message || data?.error,
    orderCode: data?.data?.order_code,
    requestId: data?.data?.request_id || requestId,
    raw: data,
  };
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
    kind: 'card',
    command: 'productlist',
    method: 'get',
    path: '/products',
  });
  return Array.isArray(data) ? data.map(normalizeCardProduct) : [];
};

const listTopupProducts = async () => {
  const response = await callCardPartner({
    kind: 'topup',
    command: 'productlist',
    path: '',
    useJson: true,
    payload: {},
  });
  assertSuccessfulProviderResponse(response, { command: 'productlist', kind: 'topup' });

  const data = Array.isArray(response) ? response : (response?.data || []);
  return Array.isArray(data) ? data.map(normalizeCardProduct) : [];
};

const getCardBalance = async () => {
  const config = assertCardPartnerConfigured('card');
  const data = await callCardPartner({
    kind: 'card',
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

const getTopupBalance = async () => {
  const config = assertCardPartnerConfigured('topup');
  const data = await callCardPartner({
    kind: 'topup',
    command: 'getbalance',
    path: '',
    useJson: true,
    payload: {
      wallet_number: config.walletNumber,
    },
  });

  return {
    balance: toInt(data?.data?.balance),
    currency: sanitizeText(data?.data?.currency_code || data?.data?.currency, 20) || 'VND',
    raw: data,
  };
};

const checkCardAvailable = async ({ serviceCode, value, qty = 1 }) => {
  const data = await callCardPartner({
    kind: 'card',
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
  const config = assertCardPartnerConfigured('card');
  const data = await callCardPartner({
    kind: 'card',
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
    kind: 'card',
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
  listTopupProducts,
  getCardBalance,
  getTopupBalance,
  checkCardAvailable,
  buyCard,
  redownloadCard,
  topup,
};
