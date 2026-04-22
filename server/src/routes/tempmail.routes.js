const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  validate: { default: false },
  message: { message: 'Too many temp-mail requests. Please retry shortly.' },
});

router.use(limiter);

const SESSION_HEADERS = [
  'x-session-started-at',
  'x-session-expires-at',
  'x-session-ttl-minutes',
  'x-mailbox-event-token',
];

const getTempmailBaseUrl = () => {
  const raw = String(process.env.TEMPMAIL_API_BASE_URL || '').trim();
  if (!raw) {
    const error = new Error('TEMPMAIL_API_BASE_URL is not configured on server.');
    error.status = 503;
    throw error;
  }
  return raw.replace(/\/+$/, '');
};

const buildAjaxUrl = () => `${getTempmailBaseUrl()}/ajax.php`;
const buildHealthUrl = () => `${getTempmailBaseUrl()}/health`;

const toFormBody = (payload = {}) => {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null || item === '') return;
        params.append(`${key}[]`, String(item));
      });
      return;
    }
    params.append(key, String(value));
  });
  return params;
};

const copySessionHeaders = (sourceHeaders = {}, res) => {
  SESSION_HEADERS.forEach((header) => {
    const value =
      sourceHeaders?.[header] ||
      sourceHeaders?.[header.toLowerCase()] ||
      sourceHeaders?.[header.toUpperCase()];
    if (value !== undefined && value !== null && String(value).trim()) {
      res.setHeader(header, String(value));
    }
  });
};

const parseErrorPayload = (error) => {
  const status = Number(error?.response?.status) || Number(error?.status) || 500;
  const upstreamData = error?.response?.data;
  const message =
    upstreamData?.error ||
    upstreamData?.message ||
    error?.message ||
    'Tempmail proxy request failed.';
  return { status, message, upstreamData };
};

const postAction = async (action, payload = {}, options = {}) => {
  const response = await axios.post(buildAjaxUrl(), toFormBody(payload), {
    params: { f: action },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: Number(process.env.TEMPMAIL_TIMEOUT_MS || 15000),
    ...options,
  });
  return response;
};

const getAction = async (action, params = {}, options = {}) => {
  const response = await axios.get(buildAjaxUrl(), {
    params: { f: action, ...params },
    timeout: Number(process.env.TEMPMAIL_TIMEOUT_MS || 15000),
    ...options,
  });
  return response;
};

router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(buildHealthUrl(), {
      timeout: Number(process.env.TEMPMAIL_TIMEOUT_MS || 15000),
    });
    return res.json(response.data || { ok: true });
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.get('/domains', async (req, res) => {
  try {
    const response = await getAction('get_domains');
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/address', async (req, res) => {
  try {
    const response = await postAction('get_email_address', {
      email_domain: req.body?.email_domain,
      sid_token: req.body?.sid_token,
      lang: req.body?.lang || 'vi',
    });
    copySessionHeaders(response.headers, res);
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/open', async (req, res) => {
  try {
    const response = await postAction('open_email_address', {
      email_addr: req.body?.email_addr,
      force_takeover: req.body?.force_takeover ? 1 : 0,
      sid_token: req.body?.sid_token,
      lang: req.body?.lang || 'vi',
    });
    copySessionHeaders(response.headers, res);
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/set-user', async (req, res) => {
  try {
    const response = await postAction('set_email_user', {
      sid_token: req.body?.sid_token,
      email_user: req.body?.email_user,
      email_domain: req.body?.email_domain,
      force_takeover: req.body?.force_takeover ? 1 : 0,
      lang: req.body?.lang || 'vi',
    });
    copySessionHeaders(response.headers, res);
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/list', async (req, res) => {
  try {
    const response = await postAction('get_email_list', {
      sid_token: req.body?.sid_token,
      offset: req.body?.offset ?? 0,
    });
    copySessionHeaders(response.headers, res);
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/email', async (req, res) => {
  try {
    const response = await postAction('fetch_email', {
      sid_token: req.body?.sid_token,
      email_id: req.body?.email_id,
    });
    copySessionHeaders(response.headers, res);
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const emailIds = Array.isArray(req.body?.email_ids)
      ? req.body.email_ids
      : req.body?.email_id
        ? [req.body.email_id]
        : [];
    const response = await postAction('del_email', {
      sid_token: req.body?.sid_token,
      email_ids: emailIds,
    });
    copySessionHeaders(response.headers, res);
    return res.json(response.data || {});
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

router.post('/attachment', async (req, res) => {
  try {
    const response = await postAction(
      'fetch_attachment',
      {
        sid_token: req.body?.sid_token,
        email_id: req.body?.email_id,
        file_name: req.body?.file_name,
      },
      { responseType: 'arraybuffer' },
    );
    copySessionHeaders(response.headers, res);
    const contentType =
      response.headers?.['content-type'] || 'application/octet-stream';
    const contentDisposition =
      response.headers?.['content-disposition'] ||
      `attachment; filename="${String(req.body?.file_name || 'attachment.bin')}"`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition);
    return res.send(Buffer.from(response.data));
  } catch (error) {
    const payload = parseErrorPayload(error);
    return res.status(payload.status).json({
      message: payload.message,
      upstream: payload.upstreamData || null,
    });
  }
});

module.exports = router;

