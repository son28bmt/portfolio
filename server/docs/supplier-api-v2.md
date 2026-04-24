# Supplier API V2

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-25`.

## 1) Mục tiêu

Mở `supplier_api` theo hướng generic:

- hiện tại chạy được `smm_panel`
- sau này thêm `digital_code/card`

Không dùng tư duy “supplier nào cũng giống nhau”.

## 2) Kiến trúc đã chốt

### 2.1 Source type

- `local_stock`
- `supplier_api`

### 2.2 Supplier kind bên trong `supplier_api`

- `smm_panel`
- `digital_code`

Ghi chú:

- `digital_code` hiện mới là slot kiến trúc
- code fulfill thật cho lane card vẫn chưa bật

## 3) Những gì đã làm

### 3.1 Backend

- có `smm-panel.service.js`
- có provider `supplier_api` trong `marketplace-fulfillment.service.js`
- hỗ trợ input order động:
  - `targetLink`
  - `quantity`
  - `comments`
- tạo external order sau khi thanh toán thành công
- lưu `externalOrderId`, `externalStatus`, `externalRaw`
- refresh tay từng order supplier
- scheduler auto refresh đơn `processing`
- sync service từ panel vào `Category/Product`

### 3.2 Admin

- có `Supplier Center`
- xem balance panel
- xem service list
- sync từng service hoặc sync hàng loạt
- quét lại queue supplier đang xử lý

### 3.3 Client

- `/cua-hang/dich-vu` hiển thị sản phẩm supplier
- có form động theo `sourceConfig`
- theo dõi đơn supplier sau khi đã thanh toán
- tra cứu lại đơn bằng `payment_ref`

## 4) Source config hiện tại cho `smm_panel`

Ví dụ:

```json
{
  "supplierKind": "smm_panel",
  "serviceId": "1234",
  "pricingModel": "per_1000",
  "minQuantity": 100,
  "maxQuantity": 10000,
  "defaultQuantity": 1000,
  "requiresTargetLink": true,
  "requiresComments": false,
  "targetLabel": "Link mục tiêu",
  "commentsLabel": "Nội dung comments",
  "serviceName": "Instagram Followers",
  "categoryName": "Instagram",
  "supplierRate": 25000,
  "lastCatalogSyncAt": "2026-04-25T10:00:00.000Z"
}
```

## 5) Flow hiện tại cho `smm_panel`

1. User chọn sản phẩm `supplier_api`.
2. User nhập `targetLink`, `quantity`, `comments` nếu cần.
3. Hệ thống tạo order nội bộ `pending`.
4. User thanh toán QR hoặc bằng quỹ.
5. Sau khi xác nhận thanh toán, backend gọi action `add`.
6. Nếu supplier trả external order:
   - `status = paid`
   - `fulfillmentStatus = processing`
7. Scheduler nền sẽ quét các đơn `processing`.
8. Admin vẫn có thể refresh tay nếu muốn.
9. Nếu supplier trả `Completed`:
   - `fulfillmentStatus = delivered`
10. Nếu supplier trả `Partial` hoặc `Canceled`:
   - `fulfillmentStatus = manual_review`

## 6) Endpoint hiện có

- `GET /api/admin/supplier/smm-panel/services`
- `GET /api/admin/supplier/smm-panel/balance`
- `POST /api/admin/supplier/smm-panel/sync-services`
- `POST /api/admin/supplier/smm-panel/refresh-processing`
- `POST /api/admin/orders/:id/refresh-fulfillment`
- `GET /api/orders/:payment_ref`

## 7) Catalog sync hiện tại

Khi sync service từ panel:

- category mới hiện mặc định vào `storeSection = service`
- chưa có auto map sang lane `card`
- chưa có diff/disable service cũ thật sự tốt

Điều này đúng với hiện trạng vì lane đang chạy thật mới là `dịch vụ`, chưa phải `card`.

## 8) Biến môi trường cần có

- `MARKET_SMM_PANEL_URL`
- `MARKET_SMM_PANEL_KEY`
- `MARKET_SMM_PANEL_TIMEOUT_MS`
- `MARKET_SUPPLIER_SYNC_ENABLED`
- `MARKET_SUPPLIER_SYNC_INTERVAL_MS`
- `MARKET_SUPPLIER_SYNC_BATCH_SIZE`
- `MARKET_SUPPLIER_MIN_SYNC_AGE_MS`

## 9) Những gì vẫn chưa làm

- auto refund / credit cho `Partial / Canceled`
- sync catalog sâu hơn: diff / disable / cleanup
- email/status update riêng cho async supplier order
- pricing/margin ops tốt hơn cho admin
- provider `digital_code/card`

## 10) Ghi chú cho phase card / mã số

Khi làm card hoặc mã giao ngay, không được nhét business logic chung với `smm_panel`.

Nên xem đó là nhánh riêng:

- `supplier_api + supplierKind = digital_code`

Vì lane này thường cần:

- nhận secret / code để giao ngay
- ẩn dữ liệu nhạy cảm
- reserve / claim / release
- email delivery rõ ràng
- logic tồn kho khác hoàn toàn `smm_panel`

## 11) Đánh giá hiện tại

`smm_panel` hiện đã usable ở mức đầu nhưng chưa đủ đẹp cho vận hành dài hạn.

Điểm ổn:

- tạo đơn được
- refresh được
- sync catalog được
- client/admin đều dùng được

Điểm chưa ổn:

- finance handling cho `Partial / Canceled` chưa xong
- lane card vẫn mới là placeholder kiến trúc
- production rollout vẫn phụ thuộc nhiều vào deploy đúng route + restart + schema DB
