# Security Hardening (2026-04-24)

## Mục tiêu

Tài liệu này ghi lại bản vá bảo mật cho các nhóm rủi ro:

- Giả mạo webhook thanh toán.
- Leo quyền vào kênh socket admin.
- Thiếu tách bạch giữa “đăng nhập” và “quyền admin”.
- Dùng JWT secret mặc định không an toàn.
- Brute-force endpoint đăng nhập.
- Rò rỉ thông tin nhạy cảm qua log.

## Thay đổi đã triển khai

### 1) Bắt buộc `JWT_SECRET` an toàn

- Thêm helper dùng chung: `server/src/utils/jwt.util.js`.
- Nếu thiếu `JWT_SECRET` hoặc để mặc định `"secret"`, hệ thống trả lỗi cấu hình bảo mật thay vì tiếp tục chạy token không an toàn.
- Áp dụng cho:
  - `auth.controller.js`
  - `auth.middleware.js`
  - `marketplace.controller.js`
  - `marketplace-admin.middleware.js`
  - `chat.routes.js` (guest token verify)
  - `socket.service.js` (guest/admin socket token)

### 2) Tách rõ quyền admin bằng middleware riêng

- Thêm middleware mới: `server/src/middleware/require-admin.middleware.js`.
- Các endpoint quản trị nay dùng `protect` + `requireAdmin`.
- Admin được xác định bởi:
  - `req.user.isAdmin === true` (token marketplace admin), hoặc
  - Username thuộc danh sách `ADMIN_USERNAMES` (mặc định: `admin`).

Đã áp dụng cho:

- `routes/blog.routes.js`
- `routes/project.routes.js`
- `routes/contact.routes.js`
- `routes/donate.routes.js` (nhóm `/admin/*`)
- `routes/shop.routes.js` (CRUD admin)
- `routes/blog-automation.routes.js` (toàn router)
- `routes/ai.routes.js` (chỉ `/config`)

### 3) Chặn leo quyền socket admin

- Event `join_admin_room` nay bắt buộc token admin hợp lệ.
- Nếu token sai/hết hạn: emit `admin_auth_error`, không cho join room.
- Event `send_to_user` và `mark_as_read` chỉ chạy khi `socket.isAdmin === true`.
- File: `server/src/services/socket.service.js`.

### 4) Webhook SePay chuyển sang fail-closed

- Trước đây thiếu `SEPAY_WEBHOOK_SECRET` vẫn pass (`ok: true`).
- Nay:
  - Mặc định: thiếu secret => **từ chối webhook**.
  - Chỉ cho bypass ở môi trường không production khi bật `ALLOW_INSECURE_WEBHOOK=true`.
- File: `server/src/services/donate.service.js`.

### 5) Turnstile fail-closed trong production

- Nếu `TURNSTILE_SECRET_KEY` thiếu ở production: trả `503` (không cho đi tiếp).
- Ở môi trường local/dev vẫn cho phép skip để tiện phát triển.
- File: `server/src/middleware/turnstile.middleware.js`.

### 6) Rate-limit cho login

- Thêm limiter cho:
  - `POST /api/auth/login`
  - `POST /api/admin/login` (marketplace)
- Mức hiện tại: `10` lần / `15` phút / IP.
- Files:
  - `server/src/routes/auth.routes.js`
  - `server/src/routes/marketplace.routes.js`

### 7) Không log thẳng secret webhook

- Log webhook đã đổi sang bản che (masked), không lưu full token/signature.
- File: `server/src/services/marketplace.service.js`.

### 8) Giảm rủi ro lộ header nhạy cảm

- Bỏ log full request headers ở debug `/api/chat`.
- File: `server/src/app.js`.

## Biến môi trường cần có

### Bắt buộc cho production

- `JWT_SECRET=<chuỗi bí mật mạnh, dài>`
- `SEPAY_WEBHOOK_SECRET=<secret webhook sepay>`
- `TURNSTILE_SECRET_KEY=<cloudflare secret>`

### Tùy chọn

- `ADMIN_USERNAMES=admin,son,...`
  - Danh sách username được xem là admin ở cụm endpoint dùng `protect + requireAdmin`.
- `ALLOW_INSECURE_WEBHOOK=true`
  - Chỉ nên dùng local/dev; production không được bật.

## Tác động hành vi (breaking changes)

1. Endpoint admin không còn chỉ cần “đăng nhập”, mà cần đúng quyền admin.
2. Thiếu `JWT_SECRET` an toàn sẽ không phát/verify token được.
3. Thiếu `SEPAY_WEBHOOK_SECRET` sẽ bị từ chối webhook.
4. Socket admin bắt buộc gửi token admin khi join phòng.

## Checklist deploy production

1. Cập nhật đầy đủ biến môi trường bắt buộc.
2. Restart tiến trình backend (PM2/Docker/systemd).
3. Kiểm tra nhanh:
   - Login user/admin hoạt động.
   - CRUD admin trả `403` nếu dùng user thường.
   - Webhook không hợp lệ trả `401`.
   - Socket admin không token thì không join được.
4. Theo dõi log 15–30 phút đầu sau deploy.

## Kết quả test tại local

- `npm run test:donate`: pass `7/7`.
- `node --check` cho toàn bộ file JS đã chỉnh: pass.
