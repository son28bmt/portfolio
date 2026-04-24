const axios = require('axios');

const SMM_ACTIONS = Object.freeze({
  SERVICES: 'services',
  BALANCE: 'balance',
  ADD: 'add',
  STATUS: 'status',
  MULTI_STATUS: 'status',
  CANCEL: 'cancel',
  REFILL: 'refill',
  REFILL_STATUS: 'refill_status',
});

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const sanitizeText = (value, max = 5000) => String(value || '').trim().slice(0, max);

const getSmmPanelConfig = () => {
  const baseUrl = normalizeUrl(process.env.MARKET_SMM_PANEL_URL);
  const apiKey = sanitizeText(process.env.MARKET_SMM_PANEL_KEY, 255);

  return {
    baseUrl,
    apiKey,
    timeoutMs: Math.max(3000, Number(process.env.MARKET_SMM_PANEL_TIMEOUT_MS) || 15000),
  };
};

const assertSmmConfigured = () => {
  const config = getSmmPanelConfig();
  if (!config.baseUrl || !config.apiKey) {
    const error = new Error(
      'Thieu cau hinh MARKET_SMM_PANEL_URL hoac MARKET_SMM_PANEL_KEY cho supplier_api.',
    );
    error.status = 500;
    throw error;
  }
  return config;
};

const buildRequestBody = (payload = {}) => {
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    body.append(key, String(value));
  });
  return body;
};

const callSmmPanel = async (payload) => {
  const config = assertSmmConfigured();
  const body = buildRequestBody({
    key: config.apiKey,
    ...payload,
  });

  try {
    const { data } = await axios.post(config.baseUrl, body.toString(), {
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return data;
  } catch (error) {
    const nextError = new Error(
      error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Khong the goi SMM panel.',
    );
    nextError.status = error?.response?.status || 502;
    throw nextError;
  }
};

const normalizeServiceRecord = (item) => ({
  service: String(item?.service || '').trim(),
  name: sanitizeText(item?.name, 255),
  type: sanitizeText(item?.type, 80),
  category: sanitizeText(item?.category, 120),
  rate: Number(item?.rate || 0),
  min: Number(item?.min || 0),
  max: Number(item?.max || 0),
  refill: Boolean(item?.refill),
  cancel: Boolean(item?.cancel),
});

const listSmmServices = async () => {
  const data = await callSmmPanel({ action: SMM_ACTIONS.SERVICES });
  return Array.isArray(data) ? data.map(normalizeServiceRecord) : [];
};

const getSmmBalance = async () => {
  const data = await callSmmPanel({ action: SMM_ACTIONS.BALANCE });
  return {
    balance: Number(data?.balance || 0),
    currency: sanitizeText(data?.currency, 10) || 'VND',
  };
};

const createSmmOrder = async ({ service, link, quantity, comments }) => {
  const data = await callSmmPanel({
    action: SMM_ACTIONS.ADD,
    service,
    link,
    quantity,
    comments,
  });

  return {
    externalOrderId: String(data?.order || '').trim(),
    raw: data,
  };
};

const getSmmOrderStatus = async (externalOrderId) => {
  const data = await callSmmPanel({
    action: SMM_ACTIONS.STATUS,
    order: externalOrderId,
  });

  return {
    charge: Number(data?.charge || 0),
    startCount: Number(data?.start_count || 0),
    status: sanitizeText(data?.status, 40),
    remains: Number(data?.remains || 0),
    raw: data,
  };
};

module.exports = {
  getSmmPanelConfig,
  assertSmmConfigured,
  listSmmServices,
  getSmmBalance,
  createSmmOrder,
  getSmmOrderStatus,
};
