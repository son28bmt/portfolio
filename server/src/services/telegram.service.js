const axios = require('axios');

const TELEGRAM_MAX_TEXT_LENGTH = 3900;

const sanitizeText = (value, max = 255) => String(value || '').trim().slice(0, max);

const toNumber = (value, fallback = null) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const formatVnd = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('vi-VN')} đ`;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: process.env.TZ || 'Asia/Saigon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const buildSiteUrl = (pathName = '') => {
  const baseUrl = sanitizeText(process.env.PUBLIC_SITE_URL, 500);
  if (!baseUrl) return '';

  try {
    return new URL(pathName, `${baseUrl.replace(/\/+$/, '')}/`).toString();
  } catch {
    return baseUrl;
  }
};

const getConfig = () => {
  const token = sanitizeText(process.env.TELEGRAM_BOT_TOKEN, 255);
  const chatId = sanitizeText(process.env.TELEGRAM_CHAT_ID, 80);
  const enabledRaw = String(process.env.TELEGRAM_NOTIFICATIONS_ENABLED || 'true').trim().toLowerCase();
  const threadId = toNumber(process.env.TELEGRAM_MESSAGE_THREAD_ID, null);

  return {
    enabled: enabledRaw !== 'false',
    token,
    chatId,
    threadId,
  };
};

let hasWarnedMissingConfig = false;

const sendTelegramMessageNow = async (text, options = {}) => {
  const config = getConfig();
  if (!config.enabled) return { ok: false, skipped: true, reason: 'disabled' };

  if (!config.token || !config.chatId) {
    if (!hasWarnedMissingConfig) {
      hasWarnedMissingConfig = true;
      console.warn('[Telegram] Thieu TELEGRAM_BOT_TOKEN hoac TELEGRAM_CHAT_ID, bo qua notify.');
    }
    return { ok: false, skipped: true, reason: 'missing_config' };
  }

  const cleanText = sanitizeText(text, TELEGRAM_MAX_TEXT_LENGTH);
  if (!cleanText) {
    return { ok: false, skipped: true, reason: 'empty_message' };
  }

  const payload = {
    chat_id: config.chatId,
    text: cleanText,
    disable_web_page_preview: true,
    disable_notification: Boolean(options.disableNotification),
  };

  if (config.threadId) {
    payload.message_thread_id = config.threadId;
  }

  await axios.post(`https://api.telegram.org/bot${config.token}/sendMessage`, payload, {
    timeout: 10000,
  });

  return { ok: true };
};

const queueTelegramNotification = (builder) => {
  Promise.resolve()
    .then(builder)
    .catch((error) => {
      console.error('[Telegram] Gui notify that bai:', error?.response?.data || error?.message || error);
    });
};

const queueTelegramLines = (lines, options = {}) => {
  const message = lines
    .map((line) => sanitizeText(line, 800))
    .filter(Boolean)
    .join('\n');

  if (!message) return;
  queueTelegramNotification(() => sendTelegramMessageNow(message, options));
};

const buildOrderLink = (paymentRef) => {
  const ref = sanitizeText(paymentRef, 80);
  if (!ref) return '';
  return buildSiteUrl(`/cua-hang/dich-vu?ref=${encodeURIComponent(ref)}`);
};

const notifyTelegramOrderCreated = ({ order, product, paymentMethod = 'qr' } = {}) => {
  if (!order) return;

  queueTelegramLines([
    '[ORDER] Don hang moi',
    `Ma: ${sanitizeText(order.payment_ref || order.paymentRef, 80)}`,
    `San pham: ${sanitizeText(product?.name || order?.product?.name || 'Khong ro', 180)}`,
    `Email: ${sanitizeText(order.email, 180)}`,
    `So tien: ${formatVnd(order.amount)}`,
    `Thanh toan: ${paymentMethod === 'wallet' ? 'Quy noi bo' : 'QR / chuyen khoan'}`,
    `Trang thai: ${sanitizeText(order.status || 'pending', 40)}`,
    buildOrderLink(order.payment_ref || order.paymentRef),
  ]);
};

const notifyTelegramOrderStatus = ({ order, title, message, product, extraLines = [] } = {}) => {
  if (!order) return;

  queueTelegramLines([
    title || '[ORDER] Cap nhat don hang',
    `Ma: ${sanitizeText(order.payment_ref || order.paymentRef, 80)}`,
    `San pham: ${sanitizeText(product?.name || order?.product?.name || 'Khong ro', 180)}`,
    `Email: ${sanitizeText(order.email, 180)}`,
    `So tien: ${formatVnd(order.amount)}`,
    `Thanh toan: ${sanitizeText(order.paymentMethod || 'qr', 40)}`,
    `Trang thai don: ${sanitizeText(order.status, 40)}`,
    `Fulfillment: ${sanitizeText(order.fulfillmentStatus, 40)}`,
    message ? sanitizeText(message, 400) : '',
    ...extraLines,
    buildOrderLink(order.payment_ref || order.paymentRef),
  ]);
};

const notifyTelegramBlogChanged = ({ blog, action = 'created', source = 'admin', actor = '' } = {}) => {
  if (!blog) return;

  const actionLabel =
    action === 'updated' ? '[BLOG] Blog da cap nhat' : '[BLOG] Blog moi da dang';
  const blogUrl = buildSiteUrl(`/blog/${sanitizeText(blog.slug, 180)}`);

  queueTelegramLines([
    actionLabel,
    `Tieu de: ${sanitizeText(blog.title, 220)}`,
    `Nguon: ${source === 'automation' ? 'Tu dong hoa' : 'Admin'}`,
    actor ? `Nguoi thuc hien: ${sanitizeText(actor, 80)}` : '',
    sanitizeText(blog.excerpt, 260),
    blogUrl,
  ]);
};

const notifyTelegramProjectChanged = ({ project, action = 'updated', actor = '' } = {}) => {
  if (!project) return;

  const title =
    action === 'created' ? '[PROJECT] Du an moi da dang' : '[PROJECT] Du an da cap nhat';
  const projectUrl = buildSiteUrl(`/du-an/${sanitizeText(project.slug || project.id, 180)}`);

  queueTelegramLines([
    title,
    `Ten du an: ${sanitizeText(project.title, 220)}`,
    `Danh muc: ${sanitizeText(project.category, 120)}`,
    actor ? `Nguoi thuc hien: ${sanitizeText(actor, 80)}` : '',
    projectUrl,
  ]);
};

const notifyTelegramProjectDownload = ({
  project,
  downloadType = 'apk',
  downloadCount = 0,
  ip = '',
} = {}) => {
  if (!project) return;

  const projectUrl = buildSiteUrl(`/du-an/${sanitizeText(project.slug || project.id, 180)}`);

  queueTelegramLines([
    '[DOWNLOAD] Co luot tai du an',
    `Du an: ${sanitizeText(project.title, 220)}`,
    `Loai tep: ${downloadType === 'ios' ? 'iOS / IPA' : 'Android / APK'}`,
    `Tong luot ${downloadType}: ${Number(downloadCount || 0).toLocaleString('vi-VN')}`,
    ip ? `IP: ${sanitizeText(ip, 80)}` : '',
    projectUrl,
  ], { disableNotification: true });
};

const notifyTelegramWalletTopupPaid = ({ topup, user, balanceAfter } = {}) => {
  if (!topup) return;

  queueTelegramLines([
    '[WALLET] Nap quy thanh cong',
    `Ma: ${sanitizeText(topup.paymentRef, 80)}`,
    `Nguoi dung: ${sanitizeText(user?.username || user?.email || '', 180)}`,
    `So tien: ${formatVnd(topup.amount)}`,
    balanceAfter !== undefined && balanceAfter !== null
      ? `So du sau nap: ${formatVnd(balanceAfter)}`
      : '',
    `Luc: ${formatDateTime(topup.paidAt || new Date())}`,
  ]);
};

module.exports = {
  sendTelegramMessageNow,
  notifyTelegramOrderCreated,
  notifyTelegramOrderStatus,
  notifyTelegramBlogChanged,
  notifyTelegramProjectChanged,
  notifyTelegramProjectDownload,
  notifyTelegramWalletTopupPaid,
};
