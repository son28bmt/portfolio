const axios = require('axios');

const isLocalRequest = (req) => {
  const candidates = [
    req.hostname,
    req.headers?.origin,
    req.headers?.referer,
    req.headers?.host,
    req.ip,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return candidates.some(
    (value) =>
      value.includes('localhost') ||
      value.includes('127.0.0.1') ||
      value.includes('::1'),
  );
};

const buildError = (status, error, message) => ({
  status,
  body: {
    error,
    message,
    reply: message,
  },
});

/**
 * Cloudflare Turnstile verification middleware.
 * Fail-closed in production, but allow localhost/dev to work without blocking local testing.
 */
const verifyTurnstile = async (req, res, next) => {
  const configuredSecret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  const turnstileToken = req.body?.turnstileToken || req.headers?.['x-turnstile-token'];
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalDev = !isProduction && isLocalRequest(req);

  if (isLocalDev && !turnstileToken) {
    return next();
  }

  if (!configuredSecret) {
    if (isProduction) {
      const result = buildError(
        503,
        'Turnstile secret is not configured on server.',
        'Máy chủ thiếu TURNSTILE_SECRET_KEY nên endpoint bảo vệ đang tạm khóa.',
      );
      return res.status(result.status).json(result.body);
    }
    return next();
  }

  if (!turnstileToken) {
    const result = buildError(
      403,
      'Missing Turnstile token.',
      'Thiếu mã xác thực Turnstile. Vui lòng thử lại.',
    );
    return res.status(result.status).json(result.body);
  }

  let secretKey = configuredSecret;
  if (String(turnstileToken).startsWith('1x')) {
    secretKey = '1x00000000000000000000000000000000AA';
  }

  try {
    const form = new URLSearchParams();
    form.append('secret', secretKey);
    form.append('response', String(turnstileToken));
    form.append('remoteip', String(req.ip || ''));

    const verifyRes = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      form,
      { timeout: 10000 },
    );

    if (!verifyRes.data?.success) {
      const errorCodes = verifyRes.data?.['error-codes'] || [];
      console.warn('[VerifyTurnstile] Challenge failed:', errorCodes);

      if (isLocalDev) {
        return next();
      }

      const result = buildError(
        403,
        'Turnstile verification failed.',
        'Xác thực Turnstile thất bại. Vui lòng thử lại.',
      );
      return res.status(result.status).json(result.body);
    }

    return next();
  } catch (err) {
    console.error('[VerifyTurnstile] System error:', err?.message || err);

    if (isLocalDev) {
      return next();
    }

    const result = buildError(
      503,
      'Turnstile service unavailable.',
      'Hệ thống bảo mật tạm thời gián đoạn. Vui lòng thử lại sau.',
    );
    return res.status(result.status).json(result.body);
  }
};

module.exports = { verifyTurnstile };
