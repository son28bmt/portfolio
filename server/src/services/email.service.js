const nodemailer = require("nodemailer");
require("dotenv").config();

const getTransporter = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  const pass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("Chưa cấu hình EMAIL_USER hoặc EMAIL_PASS cho SMTP Gmail.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

const sendMarketplaceDeliveryEmail = async ({
  to,
  productName,
  productData,
  orderId,
}) => {
  const transporter = getTransporter();
  const fromName = String(
    process.env.MARKET_FROM_NAME || "Chợ số tự động",
  ).trim();
  const user = String(process.env.EMAIL_USER || "").trim();

  return transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `Đơn hàng #${orderId} đã thanh toán thành công`,
    html: `
      <!DOCTYPE html>
      <html lang="vi">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">

        <!-- Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

              <!-- Header -->
              <tr>
                <td style="background:#1e3a5f;padding:28px 40px;border-radius:8px 8px 0 0">
                  <h1 style="margin:0;font-size:20px;color:#ffffff;letter-spacing:0.5px">
                    Xác nhận đơn hàng
                  </h1>
                  <p style="margin:4px 0 0;font-size:13px;color:#93c5fd">
                    Mã đơn: <strong>#${orderId}</strong>
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background:#ffffff;padding:32px 40px">

                  <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7">
                    Cảm ơn bạn đã tin tưởng và mua hàng. Đơn hàng của bạn đã được xử lý thành công
                    và thông tin sản phẩm được giao tự động bên dưới.
                  </p>

                  <!-- Order summary -->
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px">
                    <tr style="background:#f9fafb">
                      <td style="padding:10px 16px;font-size:12px;font-weight:bold;color:#6b7280;
                                 text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb">
                        Thông tin đơn hàng
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 16px">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:13px;color:#6b7280;padding:4px 0;width:140px">Sản phẩm</td>
                            <td style="font-size:13px;color:#111827;font-weight:600">${productName}</td>
                          </tr>
                          <tr>
                            <td style="font-size:13px;color:#6b7280;padding:4px 0">Mã đơn hàng</td>
                            <td style="font-size:13px;color:#111827;font-weight:600">#${orderId}</td>
                          </tr>
                          <tr>
                            <td style="font-size:13px;color:#6b7280;padding:4px 0">Trạng thái</td>
                            <td>
                              <span style="display:inline-block;background:#dcfce7;color:#166534;
                                           font-size:12px;font-weight:600;padding:2px 10px;border-radius:20px">
                                Đã thanh toán
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Product data box -->
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1e3a5f;
                             text-transform:uppercase;letter-spacing:0.5px">
                    Thông tin tài khoản / key
                  </p>
                  <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-left:4px solid #1e3a5f;
                               border-radius:6px;padding:16px 20px;margin-bottom:24px">
                    <pre style="margin:0;font-size:14px;color:#1e3a5f;white-space:pre-wrap;
                                font-family:'Courier New',monospace;line-height:1.7">${productData}</pre>
                  </div>

                  <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7">
                    Nếu bạn gặp bất kỳ vấn đề nào, vui lòng phản hồi trực tiếp email này.
                    Chúng tôi sẽ hỗ trợ trong thời gian sớm nhất.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#1e3a5f;padding:20px 40px;border-radius:0 0 8px 8px;text-align:center">
                  <p style="margin:0;font-size:12px;color:#93c5fd;line-height:1.6">
                    Email này được gửi tự động, vui lòng không reply nếu không cần hỗ trợ.<br>
                    &copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>

      </body>
      </html>
    `,
  });
};

const sendProductEmail = async (to, productName, productData) => {
  return sendMarketplaceDeliveryEmail({
    to,
    productName,
    productData,
    orderId: "N/A",
  });
};

module.exports = {
  sendMarketplaceDeliveryEmail,
  sendProductEmail,
};
