# Marketplace

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-25`.

## 1) Mục tiêu hiện tại

Marketplace hiện phục vụ 3 việc chính:

- bán sản phẩm nội bộ bằng `local_stock`
- bán dịch vụ supplier qua `supplier_api + smm_panel`
- giữ chỗ kiến trúc cho lane `card / mã số / giao ngay`

Checkout vẫn giữ theo hướng `guest-first`, còn member lane được mở rộng qua wallet và account.

## 2) Kiến trúc bắt buộc

Không được đồng nhất:

- `catalog`
- `payment`
- `fulfillment`

Từ V1 trở đi:

- `local_stock` chỉ là một fulfillment provider
- `supplier_api` là provider layer riêng
- `digital_code/card` là lane tương lai, không được nhét logic chung với `smm_panel`

## 3) Auth khi mua

- khách vẫn có thể mua bằng QR mà không cần đăng nhập
- đăng nhập/đăng ký không phải điều kiện bắt buộc để checkout
- đăng nhập/đăng ký dùng cho:
  - quỹ nội bộ
  - lịch sử mua
  - ưu đãi về sau

Chi tiết member lane nằm ở [internal-fund-v1.md](/e:/portfolio/server/docs/internal-fund-v1.md).

## 4) Trạng thái hiện tại

### 4.1 Marketplace core đã chạy

- `products` có `sourceType`, `sourceConfig`
- `orders` có `fulfillmentStatus`, `fulfillmentSource`, `fulfillmentPayload`, `productSnapshot`, `sourceSnapshot`
- fulfillment provider registry đã tách khỏi logic order chính
- `local_stock` chạy được
- QR order chạy được
- wallet checkout chạy được
- tra cứu đơn bằng `payment_ref` chạy được

### 4.2 Supplier V2 bản đầu đã usable

Hiện đã enable:

- `sourceType = supplier_api`
- `supplierKind = smm_panel`
- input động cho supplier order:
  - `targetLink`
  - `quantity`
  - `comments`
- tạo external order sau khi thanh toán
- auto refresh các đơn `processing`
- refresh tay từng đơn
- sync service list từ panel vào catalog nội bộ
- admin có `Supplier Center`

Hiện chưa enable:

- `supplierKind = digital_code`
- lane card giao ngay thật

### 4.3 Storefront hiện tại

Client hiện đã tách thành các lane:

- `/cua-hang`: hub
- `/cua-hang/dich-vu`: dịch vụ đang bán
- `/cua-hang/tu-them`: hàng nội bộ tự thêm
- `/cua-hang/card`: placeholder “đang phát triển”

### 4.4 Admin hiện tại

Admin đã có:

- categories có `storeSection`
- products hiển thị theo section/category
- supplier center
- wallet tab
- dashboard summary có tổng tiền đã nhận

## 5) Route chính

### Public

- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders/:payment_ref/status`
- `GET /api/orders/:payment_ref`
- `GET /api/sse/orders/:payment_ref`

### Webhook

- order:
  - `POST /api/order/webhook/sepay`
  - alias cũ:
    - `POST /api/orders/webhook/sepay`
    - `POST /api/webhook/sepay`
- wallet:
  - `POST /api/wallet/webhook/sepay`
- donate:
  - `POST /api/donate/webhook/sepay`

Ghi chú:

- mỗi lane nên dùng webhook riêng
- wrong-lane webhook nên trả `ignored`, không fail cứng

### Admin marketplace

- `POST /api/admin/login`
- `GET/POST/PUT/DELETE /api/admin/products`
- `GET/POST/PUT/DELETE /api/admin/stock_items`
- `GET/POST/PUT/DELETE /api/admin/categories`
- `GET/POST/PUT/DELETE /api/admin/orders`

### Admin supplier

- `GET /api/admin/supplier/smm-panel/services`
- `GET /api/admin/supplier/smm-panel/balance`
- `POST /api/admin/supplier/smm-panel/sync-services`
- `POST /api/admin/supplier/smm-panel/refresh-processing`
- `POST /api/admin/orders/:id/refresh-fulfillment`

### Admin wallet / dashboard liên quan

- `GET /api/admin/wallet/users`
- `GET /api/admin/wallet/topups`
- `GET /api/admin/wallet/ledger`
- `GET /api/admin/dashboard/summary`

## 6) Luồng order hiện tại

1. FE tạo `POST /api/orders`.
2. Backend tạo order `pending`, snapshot product/source.
3. User thanh toán đúng `payment_ref`.
4. SePay gọi webhook order.
5. Backend verify webhook, lock transaction và gọi fulfillment provider.
6. Nếu là `local_stock`:
   - giao stock item ngay
   - `fulfillmentStatus = delivered`
7. Nếu là `supplier_api + smm_panel`:
   - tạo external order
   - `fulfillmentStatus = processing`
   - scheduler/admin sẽ refresh tiếp

## 7) Những gì còn chưa chuẩn hoặc chưa tốt

### 7.1 Chưa nên gọi là “xong hết”

- member security chưa xong
- admin wallet mới mức cơ bản
- supplier API mới usable cho `smm_panel`
- `digital_code/card` chưa bật thật

### 7.2 Gap vận hành hiện có

1. Production rất dễ lỗi nếu chưa deploy backend mới hoặc chưa restart process sau khi thêm route/schema.
2. Database production vẫn có thể thiếu cột mới như `orders.fulfillmentStatus`, `orders.payment_method`, `categories.store_section`.
3. `Partial / Canceled` của supplier hiện mới đẩy về `manual_review`, chưa có credit/refund tự động.
4. Double transfer vào cùng một mã topup/order chưa có flow xử lý đẹp, chủ yếu là chặn auto xử lý trùng và để vận hành thủ công.
5. Vẫn còn route legacy `shop.routes.js` cùng tồn tại trong app, dễ gây nhầm giữa shop cũ và marketplace mới.

## 8) V2 hiện còn thiếu

- auto refund / credit cho `Partial / Canceled`
- provider `digital_code/card`
- domain model riêng cho card giao ngay
- sync catalog sâu hơn: diff / disable / cleanup
- email và status update riêng cho async supplier
- margin / pricing ops rõ ràng hơn trong admin

## 9) Hướng đi tiếp

V2 nên tiếp tục theo hướng:

- giữ nguyên payment + order core hiện tại
- thêm provider mới thay vì đập lại flow cũ
- phát triển lane `card / mã số` như một lane riêng, không trộn với `smm_panel`

Tham chiếu:

- member lane: [internal-fund-v1.md](/e:/portfolio/server/docs/internal-fund-v1.md)
- roadmap phase: [marketplace-v1-v2-roadmap.md](/e:/portfolio/server/docs/marketplace-v1-v2-roadmap.md)
- supplier lane: [supplier-api-v2.md](/e:/portfolio/server/docs/supplier-api-v2.md)
