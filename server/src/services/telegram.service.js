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
  const enabledRaw = String(process.env.TELEGRAM_NOTIFICATIONS_ENABLED || 'true')
    .trim()
    .toLowerCase();
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
      console.error(
        '[Telegram] Gui notify that bai:',
        error?.response?.data || error?.message || error,
      );
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

const sectionTitle = (prefix, title) => `${prefix} ${title}`.trim();
const divider = () => '────────────────';

const bullet = (label, value) => {
  const cleanValue = sanitizeText(value, 500);
  if (!cleanValue) return '';
  return `• ${label}: ${cleanValue}`;
};

const note = (value) => {
  const cleanValue = sanitizeText(value, 500);
  if (!cleanValue) return '';
  return `• Ghi chú: ${cleanValue}`;
};

const buildOrderLink = (paymentRef) => {
  const ref = sanitizeText(paymentRef, 80);
  if (!ref) return '';
  return buildSiteUrl(`/cua-hang/dich-vu?ref=${encodeURIComponent(ref)}`);
};

const notifyTelegramOrderCreated = ({ order, product, paymentMethod = 'qr' } = {}) => {
  if (!order) return;

  queueTelegramLines([
    sectionTitle('[ORDER]', 'Đơn hàng mới'),
    divider(),
    bullet('Mã', order.payment_ref || order.paymentRef),
    bullet('Sản phẩm', product?.name || order?.product?.name || 'Không rõ'),
    bullet('Email', order.email),
    bullet('Số tiền', formatVnd(order.amount)),
    bullet('Thanh toán', paymentMethod === 'wallet' ? 'Quỹ nội bộ' : 'QR / chuyển khoản'),
    bullet('Trạng thái', order.status || 'pending'),
    buildOrderLink(order.payment_ref || order.paymentRef),
  ]);
};

const notifyTelegramOrderStatus = ({ order, title, message, product, extraLines = [] } = {}) => {
  if (!order) return;

  queueTelegramLines([
    title || sectionTitle('[ORDER]', 'Cập nhật đơn hàng'),
    divider(),
    bullet('Mã', order.payment_ref || order.paymentRef),
    bullet('Sản phẩm', product?.name || order?.product?.name || 'Không rõ'),
    bullet('Email', order.email),
    bullet('Số tiền', formatVnd(order.amount)),
    bullet('Thanh toán', order.paymentMethod || 'qr'),
    bullet('Trạng thái đơn', order.status),
    bullet('Fulfillment', order.fulfillmentStatus),
    note(message),
    ...extraLines,
    buildOrderLink(order.payment_ref || order.paymentRef),
  ]);
};

const notifyTelegramBlogChanged = ({
  blog,
  action = 'created',
  source = 'admin',
  actor = '',
} = {}) => {
  if (!blog) return;

  const actionLabel =
    action === 'updated'
      ? sectionTitle('[BLOG]', 'Blog đã cập nhật')
      : sectionTitle('[BLOG]', 'Blog mới đã đăng');
  const blogUrl = buildSiteUrl(`/blog/${sanitizeText(blog.slug, 180)}`);

  queueTelegramLines([
    actionLabel,
    divider(),
    bullet('Tiêu đề', blog.title),
    bullet('Nguồn', source === 'automation' ? 'Tự động hóa' : 'Admin'),
    bullet('Người thực hiện', actor),
    blog.excerpt ? `• Tóm tắt: ${sanitizeText(blog.excerpt, 260)}` : '',
    blogUrl,
  ]);
};

const notifyTelegramProjectChanged = ({ project, action = 'updated', actor = '' } = {}) => {
  if (!project) return;

  const title =
    action === 'created'
      ? sectionTitle('[PROJECT]', 'Dự án mới đã đăng')
      : sectionTitle('[PROJECT]', 'Dự án đã cập nhật');
  const projectUrl = buildSiteUrl(`/du-an/${sanitizeText(project.slug || project.id, 180)}`);

  queueTelegramLines([
    title,
    divider(),
    bullet('Tên dự án', project.title),
    bullet('Danh mục', project.category),
    bullet('Người thực hiện', actor),
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

  queueTelegramLines(
    [
      sectionTitle('[DOWNLOAD]', 'Có lượt tải dự án'),
      divider(),
      bullet('Dự án', project.title),
      bullet('Loại tệp', downloadType === 'ios' ? 'iOS / IPA' : 'Android / APK'),
      bullet(`Tổng lượt ${downloadType}`, Number(downloadCount || 0).toLocaleString('vi-VN')),
      bullet('IP', ip),
      projectUrl,
    ],
    { disableNotification: true },
  );
};

const notifyTelegramWalletTopupPaid = ({ topup, user, balanceAfter } = {}) => {
  if (!topup) return;

  queueTelegramLines([
    sectionTitle('[WALLET]', 'Nạp quỹ thành công'),
    divider(),
    bullet('Mã', topup.paymentRef),
    bullet('Người dùng', user?.username || user?.email || ''),
    bullet('Số tiền', formatVnd(topup.amount)),
    balanceAfter !== undefined && balanceAfter !== null
      ? bullet('Số dư sau nạp', formatVnd(balanceAfter))
      : '',
    bullet('Lúc', formatDateTime(topup.paidAt || new Date())),
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
