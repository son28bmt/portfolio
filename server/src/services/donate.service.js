const crypto = require('crypto');
const Setting = require('../models/Setting');

const DONATION_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  FAILED: 'failed',
});

const DEFAULTS = Object.freeze({
  minAmount: 0,
  maxAmount: 20000000,
  expireMinutes: 15,
  bankBin: '',
  accountNo: '',
  accountName: '',
});

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toAmount = (value) => {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return Math.round(parsed);
};

const sanitizeText = (value) => String(value || '').trim();

const normalizeBankAccount = (account = {}, index = 0) => {
  const key = sanitizeText(account.key || account.id || account.code || `bank_${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const bankBin = sanitizeText(account.bankBin || account.bank_bin || account.bin);
  const accountNo = sanitizeText(account.accountNo || account.account_no || account.number);
  const accountName = sanitizeText(account.accountName || account.account_name || account.name);
  const label = sanitizeText(account.label || account.title || `${accountName} - ${accountNo}`);

  if (!key || !bankBin || !accountNo || !accountName) return null;
  return {
    key,
    label: label || accountNo,
    bankBin,
    accountNo,
    accountName,
  };
};

const parseJsonBankAccounts = () => {
  const raw = sanitizeText(process.env.PAYMENT_BANK_ACCOUNTS);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.accounts;
    if (!Array.isArray(items)) return [];
    return items.map(normalizeBankAccount).filter(Boolean);
  } catch (error) {
    console.error('[Payment] PAYMENT_BANK_ACCOUNTS khong hop le:', error.message);
    return [];
  }
};

const parseNumberedBankAccounts = () => {
  const accounts = [];
  for (let index = 1; index <= 10; index += 1) {
    const account = normalizeBankAccount(
      {
        key: process.env[`PAYMENT_BANK_${index}_KEY`],
        label: process.env[`PAYMENT_BANK_${index}_LABEL`],
        bankBin: process.env[`PAYMENT_BANK_${index}_BIN`],
        accountNo: process.env[`PAYMENT_BANK_${index}_ACCOUNT_NO`],
        accountName: process.env[`PAYMENT_BANK_${index}_ACCOUNT_NAME`],
      },
      index - 1,
    );
    if (account) accounts.push(account);
  }
  return accounts;
};

const getPaymentAccounts = ({
  bankBin = process.env.DONATE_BANK_BIN || DEFAULTS.bankBin,
  accountNo = process.env.DONATE_ACCOUNT_NO || DEFAULTS.accountNo,
  accountName = process.env.DONATE_ACCOUNT_NAME || DEFAULTS.accountName,
} = {}) => {
  const configured = [...parseJsonBankAccounts(), ...parseNumberedBankAccounts()];
  const unique = new Map();

  configured.forEach((account) => {
    if (!unique.has(account.key)) unique.set(account.key, account);
  });

  const accounts = Array.from(unique.values());
  if (accounts.length > 0) return accounts;

  const legacy = normalizeBankAccount(
    {
      key: process.env.PAYMENT_BANK_DEFAULT_KEY || 'default',
      label: process.env.PAYMENT_BANK_DEFAULT_LABEL || 'Mặc định',
      bankBin,
      accountNo,
      accountName,
    },
    0,
  );
  return legacy ? [legacy] : [];
};

const resolvePaymentAccount = (bankKey, fallback = {}) => {
  const accounts = getPaymentAccounts(fallback);
  if (accounts.length === 0) return null;

  const cleanKey = sanitizeText(bankKey).toLowerCase();
  return accounts.find((account) => account.key === cleanKey) || accounts[0];
};

const PAYMENT_ACCOUNTS_SETTING_KEY = 'payment_bank_accounts';

const getStoredPaymentAccounts = async () => {
  try {
    const setting = await Setting.findOne({
      where: { key: PAYMENT_ACCOUNTS_SETTING_KEY },
    });
    if (!setting?.value) return [];

    const parsed = JSON.parse(setting.value);
    const items = Array.isArray(parsed) ? parsed : parsed?.accounts;
    if (!Array.isArray(items)) return [];
    return items.map(normalizeBankAccount).filter(Boolean);
  } catch (error) {
    console.error('[Payment] Khong doc duoc cau hinh ngan hang:', error.message);
    return [];
  }
};

const getEffectivePaymentAccounts = async (fallback = {}) => {
  const stored = await getStoredPaymentAccounts();
  return stored.length > 0 ? stored : getPaymentAccounts(fallback);
};

const resolveEffectivePaymentAccount = async (bankKey, fallback = {}) => {
  const accounts = await getEffectivePaymentAccounts(fallback);
  if (accounts.length === 0) return null;

  const cleanKey = sanitizeText(bankKey).toLowerCase();
  return accounts.find((account) => account.key === cleanKey) || accounts[0];
};

const savePaymentAccounts = async (items = []) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map(normalizeBankAccount)
    .filter(Boolean);
  const unique = new Map();

  normalized.forEach((account) => {
    if (!unique.has(account.key)) unique.set(account.key, account);
  });

  const accounts = Array.from(unique.values());
  const [setting] = await Setting.findOrCreate({
    where: { key: PAYMENT_ACCOUNTS_SETTING_KEY },
    defaults: { value: JSON.stringify(accounts) },
  });

  if (setting.value !== JSON.stringify(accounts)) {
    setting.value = JSON.stringify(accounts);
    await setting.save();
  }

  return accounts;
};

const sanitizeDonorName = (value) => {
  const clean = sanitizeText(value).replace(/\s+/g, ' ');
  return clean.slice(0, 120);
};

const getDonateConfig = () => {
  const minAmount = toAmount(process.env.DONATE_MIN_AMOUNT) || DEFAULTS.minAmount;
  const maxAmount = toAmount(process.env.DONATE_MAX_AMOUNT) || DEFAULTS.maxAmount;
  const expireMinutes = toAmount(process.env.DONATE_ORDER_EXPIRE_MINUTES) || DEFAULTS.expireMinutes;

  return {
    minAmount: Math.max(1000, minAmount),
    maxAmount: Math.max(minAmount, maxAmount),
    expireMinutes: Math.max(1, expireMinutes),
    bankBin: sanitizeText(process.env.DONATE_BANK_BIN || DEFAULTS.bankBin),
    accountNo: sanitizeText(process.env.DONATE_ACCOUNT_NO || DEFAULTS.accountNo),
    accountName: sanitizeText(process.env.DONATE_ACCOUNT_NAME || DEFAULTS.accountName),
    paymentAccounts: getPaymentAccounts({
      bankBin: process.env.DONATE_BANK_BIN || DEFAULTS.bankBin,
      accountNo: process.env.DONATE_ACCOUNT_NO || DEFAULTS.accountNo,
      accountName: process.env.DONATE_ACCOUNT_NAME || DEFAULTS.accountName,
    }),
  };
};

const randomText = (size = 6) => {
  return crypto
    .randomBytes(Math.ceil(size / 2))
    .toString('hex')
    .toUpperCase()
    .slice(0, size);
};

const generateOrderCode = () => {
  const ts = Date.now().toString(36).toUpperCase();
  return `DN${ts}${randomText(5)}`;
};

const buildTransferContent = (orderCode) => sanitizeText(orderCode).toUpperCase();

const buildVietQrUrl = ({ bankBin, accountNo, accountName, amount, transferContent }) => {
  const cleanBankBin = sanitizeText(bankBin);
  const cleanAccountNo = sanitizeText(accountNo);
  const cleanAccountName = sanitizeText(accountName);
  const cleanAmount = toAmount(amount);
  const cleanTransferContent = sanitizeText(transferContent);

  if (!cleanBankBin || !cleanAccountNo || !cleanAccountName || !cleanAmount || !cleanTransferContent) {
    return '';
  }

  const params = new URLSearchParams({
    amount: String(cleanAmount),
    addInfo: cleanTransferContent,
    accountName: cleanAccountName,
  });

  return `https://img.vietqr.io/image/${encodeURIComponent(cleanBankBin)}-${encodeURIComponent(cleanAccountNo)}-compact2.png?${params.toString()}`;
};

const safeEquals = (a, b) => {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const readHeader = (req, headerName) => {
  const value = req.headers?.[headerName];
  if (Array.isArray(value)) return sanitizeText(value[0]);
  return sanitizeText(value);
};

const verifySepayWebhook = (req) => {
  const secret = sanitizeText(process.env.SEPAY_WEBHOOK_SECRET);
  const allowInsecureWebhook =
    String(process.env.ALLOW_INSECURE_WEBHOOK || '').trim().toLowerCase() ===
      'true' && process.env.NODE_ENV !== 'production';

  if (!secret) {
    if (allowInsecureWebhook) {
      return { ok: true, reason: 'insecure-dev-mode' };
    }
    return { ok: false, reason: 'missing-secret' };
  }

  const authorizationHeader = readHeader(req, 'authorization');
  const authorizationToken = authorizationHeader
    .replace(/^Bearer\s+/i, '')
    .replace(/^Apikey\s+/i, '');

  const tokenCandidates = [
    readHeader(req, 'x-secret-key'),
    readHeader(req, 'x-sepay-token'),
    readHeader(req, 'x-webhook-token'),
    readHeader(req, 'x-api-key'),
    authorizationToken,
  ].filter(Boolean);

  if (tokenCandidates.some((token) => safeEquals(token, secret))) {
    return { ok: true, reason: 'token-matched' };
  }

  const signature = readHeader(req, 'x-sepay-signature') || readHeader(req, 'x-signature');
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';

  if (signature && rawBody) {
    const digestHex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const digestBase64 = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    if (safeEquals(signature, digestHex) || safeEquals(signature, digestBase64)) {
      return { ok: true, reason: 'hmac-matched' };
    }
  }

  return { ok: false, reason: 'invalid-signature' };
};

const pickFirst = (obj, keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const normalizeSepayPayload = (payload) => {
  const base = payload && typeof payload === 'object' ? payload : {};
  const nested = base.data && typeof base.data === 'object' ? base.data : {};
  const source = Object.keys(nested).length > 0 ? { ...base, ...nested } : base;

  const providerTxnId = sanitizeText(
    pickFirst(source, ['transactionId', 'transaction_id', 'id', 'referenceCode', 'reference', 'code', 'transId'])
  );
  const transferContent = sanitizeText(
    pickFirst(source, ['transferContent', 'transfer_content', 'content', 'description', 'transactionContent', 'message'])
  );
  const amount = toAmount(
    pickFirst(source, ['transferAmount', 'transfer_amount', 'amount', 'amountIn', 'value', 'creditAmount'])
  );
  const statusRaw = sanitizeText(pickFirst(source, ['status', 'state', 'event', 'type'])).toLowerCase();

  const successStatuses = new Set(['', 'success', 'paid', 'completed', 'done', 'credit', 'in']);
  const isSuccess = successStatuses.has(statusRaw);

  return {
    providerTxnId,
    transferContent,
    amount,
    statusRaw,
    isSuccess,
    rawPayload: base,
  };
};

const extractOrderCode = (text) => {
  const content = sanitizeText(text).toUpperCase();
  const match = content.match(/DN[A-Z0-9]{8,30}/);
  return match ? match[0] : '';
};

const getExpiresAt = (minutes) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
};

module.exports = {
  DONATION_STATUS,
  sanitizeDonorName,
  getDonateConfig,
  getPaymentAccounts,
  getEffectivePaymentAccounts,
  resolvePaymentAccount,
  resolveEffectivePaymentAccount,
  savePaymentAccounts,
  generateOrderCode,
  buildTransferContent,
  buildVietQrUrl,
  verifySepayWebhook,
  normalizeSepayPayload,
  extractOrderCode,
  getExpiresAt,
  isExpired,
  toAmount,
};
