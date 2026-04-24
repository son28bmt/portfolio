# Marketplace V1 → V2 Roadmap

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-25`.

## 1) Nguyên tắc

Marketplace được chia thành 3 lớp:

1. `catalog`
2. `payment`
3. `fulfillment`

Về user experience luôn giữ 2 lane:

1. `guest checkout`
2. `member benefits`

Các phase sau chỉ được phép mở rộng, không phá lane cũ đang chạy.

## 2) Tổng quan trạng thái

### Phase A: Marketplace core local stock

Trạng thái: `đã làm`

- tách fulfillment provider khỏi order core
- thêm `sourceType`, `sourceConfig`
- thêm fulfillment fields và snapshot trên `orders`
- guest checkout vẫn là mặc định
- local stock chạy được

### Phase B: Member / wallet core

Trạng thái: `đã làm một phần`

- register/login user thường
- account page
- topup wallet
- wallet checkout
- admin wallet read-only
- admin dashboard summary có tổng tiền nhận

Chưa xong:

- 2FA
- session management
- admin adjust/manual review
- guest-to-member linking sâu hơn

### Phase C: Supplier API

Trạng thái: `đã usable bản đầu`

- mở `supplier_api`
- chạy được `supplierKind = smm_panel`
- auto refresh supplier order `processing`
- sync service từ panel vào catalog
- admin có supplier center

### Phase D: Card / mã số / giao ngay

Trạng thái: `mới là slot sản phẩm`

- client đã có lane `/cua-hang/card`
- admin đã có `storeSection = card`
- `digital_code/card` chưa bật provider thật
- chưa có domain model giao ngay cho card/key/secret

## 3) V1 hiện tại: đã ổn gì

### Checklist đã ổn

- `products.sourceType`, `products.sourceConfig`
- `orders.fulfillmentStatus`, `orders.fulfillmentSource`, `orders.fulfillmentPayload`
- `orders.productSnapshot`, `orders.sourceSnapshot`
- provider `local_stock`
- webhook order đi qua provider
- guest-first checkout
- wallet topup + wallet checkout
- admin category theo section
- admin dashboard có finance summary

### Những gì “ổn để chạy” nhưng chưa đẹp

- admin wallet mới ở mức quan sát
- duplicate transfer chưa có flow vận hành đẹp
- production rollout vẫn dễ lệch route/schema nếu deploy không đủ

## 4) V2 hiện tại: đã làm gì

### Supplier `smm_panel`

- `sourceType = supplier_api`
- `sourceConfig.supplierKind`
- `supplierKind = smm_panel`
- input order động:
  - `targetLink`
  - `quantity`
  - `comments`
- tạo external order sau khi thanh toán
- auto refresh nền cho đơn `processing`
- refresh tay từng đơn
- sync service list từ panel vào category/product

### Store sections

Catalog hiện đã tách được theo section:

- `service`
- `custom`
- `card`

Điều này giúp:

- storefront tách lane
- admin biết category thuộc lane nào
- chuẩn bị cho card lane sau này

## 5) Những gì còn thiếu hoặc chưa chuẩn

### 5.1 V1 chưa chuẩn hoàn toàn

1. Chưa có 2FA và session management.
2. Chưa có admin adjust số dư / manual review cho wallet.
3. Chưa có test tích hợp đủ sâu cho topup/order/webhook.
4. Chưa có checklist production rõ ràng cho deploy + DB schema + webhook config.

### 5.2 V2 chưa chuẩn hoàn toàn

1. `Partial / Canceled` mới đưa về `manual_review`, chưa auto refund / credit.
2. Chưa có `digital_code/card` provider thật.
3. Chưa có sync catalog sâu như diff / disable / cleanup.
4. Chưa có margin/pricing ops đủ rõ cho vận hành lâu dài.
5. Chưa có status/email flow riêng đủ tốt cho async supplier order.

### 5.3 Technical debt

1. `shop.routes.js` legacy vẫn còn mount trong app.
2. Production dễ chạy code cũ nếu deploy/restart không đồng bộ.
3. Một số lỗi thực tế thời gian qua đến từ DB production thiếu cột hơn là do business logic sai.

## 6) Rollout checklist production

Trước khi coi phase mới là “đã lên production”, cần làm đủ:

1. deploy backend mới
2. restart process Node/PM2
3. đảm bảo DB có đủ cột mới
4. cập nhật đúng webhook SePay:
   - donate
   - wallet
   - order
5. replay lại webhook fail cũ nếu cần
6. kiểm tra tra cứu đơn `GET /api/orders/:payment_ref`

## 7) Hướng đi tiếp

### Phase 1.5: vận hành chắc hơn

- test tích hợp wallet + order + webhook
- message/log response webhook đồng bộ hơn
- xử lý duplicate transfer tốt hơn
- docs + checklist deploy chuẩn hóa

### Phase 2: member operations

- 2FA
- session management
- logout current / logout all
- admin adjust/manual review
- guest-to-member linking

### Phase 3: supplier operations hoàn chỉnh hơn

- refund / credit cho `Partial / Canceled`
- catalog diff/disable
- pricing ops tốt hơn
- alert/monitoring rõ hơn

### Phase 4: card / mã số

- provider `digital_code/card`
- reserve / claim / deliver secret
- ẩn dữ liệu nhạy cảm
- email delivery riêng
- lane storefront card thật, không còn placeholder

## 8) Tham chiếu

- member lane: [internal-fund-v1.md](/e:/portfolio/server/docs/internal-fund-v1.md)
- marketplace core: [marketplace.md](/e:/portfolio/server/docs/marketplace.md)
- supplier lane: [supplier-api-v2.md](/e:/portfolio/server/docs/supplier-api-v2.md)
