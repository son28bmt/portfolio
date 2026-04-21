const axios = require("axios");

/**
 * Cloudflare Turnstile verification middleware.
 * Fail-closed in production: invalid/missing token => reject request.
 */
const verifyTurnstile = async (req, res, next) => {
  const configuredSecret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  const turnstileToken =
    req.body?.turnstileToken || req.headers?.["x-turnstile-token"];

  // Development convenience: skip when secret is not configured.
  if (!configuredSecret) {
    return next();
  }

  if (!turnstileToken) {
    return res.status(403).json({
      error: "Missing Turnstile token.",
      reply: "Thieu ma xac thuc Turnstile. Vui long thu lai.",
    });
  }

  // Support Cloudflare public test token prefix.
  let secretKey = configuredSecret;
  if (String(turnstileToken).startsWith("1x")) {
    secretKey = "1x00000000000000000000000000000000AA";
  }

  try {
    const form = new URLSearchParams();
    form.append("secret", secretKey);
    form.append("response", String(turnstileToken));
    form.append("remoteip", String(req.ip || ""));

    const verifyRes = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      form,
      { timeout: 10000 },
    );

    if (!verifyRes.data?.success) {
      const errorCodes = verifyRes.data?.["error-codes"] || [];
      console.warn("[VerifyTurnstile] challenge failed:", errorCodes);
      return res.status(403).json({
        error: "Turnstile verification failed.",
        reply: "Xac thuc Turnstile that bai. Vui long thu lai.",
      });
    }

    return next();
  } catch (err) {
    console.error("[VerifyTurnstile] system error:", err?.message || err);
    return res.status(503).json({
      error: "Turnstile service unavailable.",
      reply: "He thong bao mat tam thoi gian doan. Vui long thu lai sau.",
    });
  }
};

module.exports = { verifyTurnstile };
