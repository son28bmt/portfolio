# Marketplace V1

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-24`.

## 1) Mục tiêu hiện tại

Marketplace V1 vẫn tập trung vào bài toán bán hàng số nội bộ:

- hiển thị catalog sản phẩm
- tạo đơn QR qua SePay
- xác nhận webhook
- fulfill tự động bằng stock nội bộ
- gửi email giao hàng
- giữ checkout theo hướng guest-first

Tuy nhiên V1 đã được refactor để không khóa cứng hệ thống vào `stock_items`.

## 2) Ghi chú kiến trúc bắt buộc

Không được đồng nhất:

- `product catalog`
- `fulfillment source`
- `delivery payload`

Từ V1 trở đi, `local_stock` chỉ là một fulfillment provider.
V2 bổ sung `supplier_api` mà không đập lại flow order/payment.

## 3) Nguyên tắc auth khi mua

- khách vẫn có thể mua ngay bằng QR mà không cần đăng nhập
- đăng nhập/đăng ký không phải điều kiện để checkout
- đăng nhập/đăng ký là để nhận ưu đãi, giữ lịch sử mua, dùng quỹ nội bộ và mở rộng sang lane member

Lane member được mô tả chi tiết ở [internal-fund-v1.md](/e:/portfolio/server/docs/internal-fund-v1.md).

## 4) Trạng thái hiện tại

### 4.1 Đã có trong code

- `products` có `sourceType`, `sourceConfig`
- `orders` có `fulfillmentStatus`, `fulfillmentSource`, `fulfillmentPayload`, `productSnapshot`, `sourceSnapshot`
- fulfillment provider registry đã tồn tại
- provider `local_stock` chạy ổn cho V1
- webhook thanh toán đi qua provider, không gọi cứng `StockItem.findOne(...)`
- guest checkout vẫn là lane mặc định
- member lane cơ bản đã có account, wallet, wallet checkout

### 4.2 Đã bật ở V2 bản đầu

Hiện tại backend đã mở được `supplier_api` cho nhánh `smm_panel`:

- sản phẩm có thể mang `sourceType = supplier_api`
- `sourceConfig` có `supplierKind`
- `supplierKind = smm_panel` đã được enable
- `supplierKind = digital_code` đã được giữ chỗ nhưng chưa bật

Với `smm_panel`, đơn hàng có thể nhận thêm input động:

- `targetLink`
- `quantity`
- `comments`

Sau khi thanh toán thành công:

- hệ thống tạo external order ở supplier
- `fulfillmentStatus` có thể chuyển sang `processing`
- scheduler nền sẽ auto refresh trạng thái supplier
- admin vẫn có thể refresh tay một đơn nếu cần
- admin có thể kéo service list và balance từ panel, rồi sync vào catalog nội bộ
- admin có `Supplier Center` riêng để vận hành nhánh `smm_panel`
- client có thể tra cứu lại đơn bằng `payment_ref` mà không cần giữ nguyên phiên checkout

## 5) Route chính hiện tại

### Public

- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders/:payment_ref/status`
- `GET /api/orders/:payment_ref`
- `GET /api/sse/orders/:payment_ref`

### Webhook

- `POST /api/webhook/sepay`

### Admin marketplace core

- `POST /api/admin/login`
- `GET/POST/PUT/DELETE /api/admin/products`
- `GET/POST/PUT/DELETE /api/admin/stock_items`
- `GET/POST/PUT/DELETE /api/admin/categories`
- `GET/POST/PUT/DELETE /api/admin/orders`

### Admin member/wallet liên quan

- `GET /api/admin/wallet/users`
- `GET /api/admin/wallet/topups`
- `GET /api/admin/wallet/ledger`

### Admin supplier V2 bản đầu

- `GET /api/admin/supplier/smm-panel/services`
- `GET /api/admin/supplier/smm-panel/balance`
- `POST /api/admin/supplier/smm-panel/sync-services`
- `POST /api/admin/supplier/smm-panel/refresh-processing`
- `POST /api/admin/orders/:id/refresh-fulfillment`

## 6) Luồng mua hàng V1

1. FE gọi `POST /api/orders` với `email` và `product_id`.
2. Backend tạo `order` `pending`, đồng thời snapshot sản phẩm và source.
3. Người dùng chuyển khoản đúng `payment_ref`.
4. SePay webhook gọi `POST /api/webhook/sepay`.
5. Backend verify webhook, lock transaction và chuyển đơn sang fulfillment provider.
6. Nếu là `local_stock`, hệ thống cấp `stock_item`.
7. Nếu là `supplier_api`, hệ thống tạo external order và chuyển đơn sang `processing`.
8. Đơn được cập nhật `status/fulfillmentStatus`, đẩy realtime cho admin/client.

## 7) Phần member & wallet

Marketplace core không còn đứng riêng hoàn toàn. Hiện tại đã có lane member cơ bản:

- register/login user thường
- account page
- topup wallet
- wallet checkout
- lịch sử ledger
- lịch sử mua bằng quỹ
- admin wallet read-only

Chi tiết xem ở [internal-fund-v1.md](/e:/portfolio/server/docs/internal-fund-v1.md).

## 8) Những gì chưa được coi là xong

Không nên nói “Marketplace V1 xong hết” vì hiện vẫn còn:

- member security chưa xong
- admin wallet mới ở mức read-only cơ bản
- supplier API mới ở mức usable cho `smm_panel`
- chưa có hoàn tiền tự động cho `Partial/Canceled`
- chưa có lane `digital_code/card`

## 9) Định hướng V2

Khi đã làm việc xong với nhà cung cấp và có API phù hợp, V2 tiếp tục theo hướng:

- nhánh đang chạy là `supplier_api + smm_panel`
- nhánh để dành tiếp theo là `supplier_api + digital_code/card`
- map `product` <-> `serviceId` hoặc `supplierSku` tùy loại supplier
- đồng bộ dữ liệu supplier
- auto refresh trạng thái
- retry, timeout, manual review, operational log

V2 phải là bổ sung provider mới, không phải đập lại flow order/payment của V1.
