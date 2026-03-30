const nodemailer = require('nodemailer');
require('dotenv').config();

const getTransporter = () => {
  const user = String(process.env.EMAIL_USER || '').trim();
  const pass = String(process.env.EMAIL_PASS || '').trim();

  if (!user || !pass) {
    throw new Error('Chưa cấu hình EMAIL_USER hoặc EMAIL_PASS cho SMTP Gmail.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

const sendMarketplaceDeliveryEmail = async ({ to, productName, productData, orderId }) => {
  const transporter = getTransporter();
  const fromName = String(process.env.MARKET_FROM_NAME || 'Chợ số tự động').trim();
  const user = String(process.env.EMAIL_USER || '').trim();

  return transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `Đơn hàng #${orderId} đã thanh toán thành công`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin:0 0 12px">Cảm ơn bạn đã mua hàng</h2>
        <p>Đơn hàng <strong>#${orderId}</strong> cho sản phẩm <strong>${productName}</strong> đã được giao tự động.</p>
        <div style="margin:16px 0;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb">
          <h3 style="margin:0 0 8px;font-size:16px">Thông tin tài khoản/key của bạn</h3>
          <pre style="white-space:pre-wrap;margin:0;font-size:14px;color:#4b5563">${productData}</pre>
        </div>
        <p>Nếu có vấn đề, vui lòng phản hồi email này để được hỗ trợ.</p>
      </div>
    `,
  });
};

const sendProductEmail = async (to, productName, productData) => {
  return sendMarketplaceDeliveryEmail({
    to,
    productName,
    productData,
    orderId: 'N/A',
  });
};

module.exports = {
  sendMarketplaceDeliveryEmail,
  sendProductEmail,
};
