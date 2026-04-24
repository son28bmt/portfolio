# Marketplace Fulfillment Roadmap

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-24`.

## 1) Nguyên tắc

Marketplace được chia thành 3 lớp:

1. `catalog`
2. `payment`
3. `fulfillment`

Về user experience luôn giữ 2 lane:

1. `guest checkout`
2. `member benefits`

Lane thứ hai được tăng dần theo phase, nhưng lane thứ nhất không được bị phá.

## 2) Trạng thái tổng quan

### Phase A: Marketplace core local stock

Trạng thái: `đã làm`

- đã tách fulfillment provider khỏi `marketplace.service`
- đã thêm `sourceType`, `sourceConfig`
- đã thêm snapshot và fulfillment fields trên `orders`
- đã giữ guest checkout là mặc định

### Phase B: Member/wallet core

Trạng thái: `đã làm một phần`

- đã có register/login user thường
- đã có account page
- đã có topup wallet
- đã có wallet checkout
- đã có admin wallet read-only

Chưa xong:

- 2FA
- session management
- admin adjust/manual review
- guest-to-member conversion flow sâu hơn

### Phase C: Supplier API

Trạng thái: `đã usable bản đầu`

- đã đọc spec provider dạng `smm_panel`
- đã mở `supplier_api` ở backend
- đã chừa `supplierKind` để sau này thêm `digital_code/card`
- đã có auto refresh nền cho đơn supplier đang `processing`
- đã có sync service từ panel vào admin/catalog

## 3) V1: local stock, sẵn sàng cho V2

### Mục tiêu

- vẫn ship nhanh với kho nội bộ hiện tại
- không đổi luồng QR/SePay đang chạy
- không ép đăng nhập khi mua
- chuẩn bị sẵn để sau này supplier API chỉ là thêm provider mới

### Checklist V1 hiện tại

- `products.sourceType`, `products.sourceConfig`: xong
- `orders.fulfillmentStatus`, `orders.fulfillmentSource`, `orders.fulfillmentPayload`: xong
- `orders.productSnapshot`, `orders.sourceSnapshot`: xong
- provider `local_stock`: xong
- webhook đi qua provider: xong
- guest-first checkout: xong
- CTA sau guest checkout: xong
- admin member/wallet search/filter cơ bản: xong
- admin member/wallet đủ để vận hành sâu: chưa xong

## 4) V2: supplier API / dropshipping

### Việc đã làm ở V2 bản đầu

- mở `sourceType = supplier_api`
- thêm `sourceConfig.supplierKind`
- hỗ trợ `supplierKind = smm_panel`
- giữ chỗ cho `supplierKind = digital_code`
- cho phép order input động:
  - `targetLink`
  - `quantity`
  - `comments`
- tạo external order qua SMM panel sau khi thanh toán thành công
- lưu `externalOrderId` và `externalStatus` trong `fulfillmentPayload`
- hỗ trợ admin refresh thủ công trạng thái supplier
- tự động refresh các đơn supplier đang `processing`
- sync catalog từ panel về `Category/Product`
- hiển thị balance/service list của panel trong admin
- thêm `Supplier Center` ở admin để vận hành queue + sync service
- thêm tra cứu đơn ở client bằng `payment_ref`

### Việc còn lại ở V2

- xử lý tài chính cho `Partial` / `Canceled`
- manual review flow tốt hơn
- disable hoặc diff catalog cũ từ supplier rõ hơn
- email/status update riêng cho supplier async order
- thêm provider `digital_code/card`
- thêm supplier sync và card-specific domain model khi làm lane thẻ cào

## 5) Mục tiêu “không phá V1”

Sau khi lên V2, các phần sau không nên phải viết lại từ đầu:

- route public/admin
- luồng tạo order
- luồng thanh toán SePay
- SSE / socket notify
- email giao hàng cho lane nội bộ

Chỉ nên bổ sung provider, config và operational flow cho supplier.

## 6) Tham chiếu

- member lane: [internal-fund-v1.md](/e:/portfolio/server/docs/internal-fund-v1.md)
- marketplace core: [marketplace.md](/e:/portfolio/server/docs/marketplace.md)
- supplier lane: [supplier-api-v2.md](/e:/portfolio/server/docs/supplier-api-v2.md)
