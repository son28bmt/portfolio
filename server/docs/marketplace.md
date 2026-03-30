# Mini Marketplace API

## Route công khai
- `GET /api/products`
- `POST /api/orders`

## Webhook
- `POST /api/webhook/sepay`

## Route admin
- `POST /api/admin/login`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `GET /api/admin/stock_items`
- `POST /api/admin/stock_items`
- `PUT /api/admin/stock_items/:id`
- `DELETE /api/admin/stock_items/:id`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `POST /api/admin/orders`
- `PUT /api/admin/orders/:id`
- `DELETE /api/admin/orders/:id`

## Luồng mua hàng
1. Frontend gọi `POST /api/orders` với `email` và `product_id`.
2. Backend tạo `order` trạng thái `pending` và trả `qr_url`.
3. Người dùng chuyển khoản với đúng `payment_ref`.
4. SePay gửi webhook về `POST /api/webhook/sepay`.
5. Backend xác thực webhook, khóa transaction, cấp 1 `stock_item` còn trống, cập nhật trạng thái `paid`.
6. Hệ thống gửi email thông tin tài khoản/key cho khách.
