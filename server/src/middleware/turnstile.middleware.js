const axios = require('axios');

/**
 * Middleware xác thực Cloudflare Turnstile (Anti-Bot)
 * Sử dụng cho các form công khai như Contact, AI Chat, Tạo đơn hàng.
 */
const verifyTurnstile = async (req, res, next) => {
  const { turnstileToken } = req.body;
  
  // Nếu Admin chưa cấu hình Secret Key thì tạm thời bỏ qua (thuận tiện cho Dev)
  if (!process.env.TURNSTILE_SECRET_KEY) {
    return next();
  }

  // Cho phép bỏ qua xác thực nếu đang ở môi trường Development và sử dụng "Testing Keys" của Cloudflare
  // Site Key: 1x00000000000000000000AA, Secret: 1x00000000000000000000000000000000AA
  const isTestKey = process.env.TURNSTILE_SECRET_KEY === '1x00000000000000000000000000000000AA';
  if (isTestKey && turnstileToken === 'XXXX.DUMMY.TOKEN.XXXX') {
    return next();
  }
  
  if (!turnstileToken) {
    console.warn('[VerifyTurnstile] Thiếu token từ IP:', req.ip, 'Body keys:', Object.keys(req.body));
    return res.status(403).json({ 
      error: 'Bảo mật: Thiếu mã xác thực an ninh Cloudflare (Turnstile Token).',
      reply: 'Bảo mật: Thiếu mã xác thực an ninh Cloudflare (Turnstile Token).' 
    });
  }
  
  try {
    const form = new URLSearchParams();
    form.append('secret', process.env.TURNSTILE_SECRET_KEY);
    form.append('response', turnstileToken);
    form.append('remoteip', req.ip);
    
    const verifyRes = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', form);
    
    if (!verifyRes.data.success) {
      console.error('[VerifyTurnstile] Cloudflare từ chối. Error codes:', verifyRes.data['error-codes']);
      return res.status(403).json({ 
        error: 'Bảo mật: Xác thực Cloudflare Turnstile thất bại (Nghi vấn Bot/Auto Tool).',
        reply: 'Bảo mật: Xác thực Cloudflare Turnstile thất bại (Nghi vấn Bot/Auto Tool).' 
      });
    }
    next();
  } catch (err) {
    console.error('[VerifyTurnstile] Lỗi hệ thống khi xác thực:', err.message);
    // Nếu lỗi kết nối server (ví dụ Cloudflare sập), chúng ta tạm thời cho qua để không làm gián đoạn trải nghiệm người dùng
    return next();
  }
};

module.exports = { verifyTurnstile };
