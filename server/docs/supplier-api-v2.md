# Supplier API V2

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-24`.

## 1) Mục tiêu

Mở `supplier_api` theo hướng generic:

- hiện tại chạy được `smm_panel`
- sau này thêm `digital_code/card`

Không dùng tư duy “provider nào cũng giống nhau”.

## 2) Kiến trúc đã chốt

### 2.1 Source type

- `local_stock`
- `supplier_api`

### 2.2 Supplier kind bên trong `supplier_api`

- `smm_panel`
- `digital_code`

Ghi chú:

- `digital_code` hiện mới là slot kiến trúc
- chưa được kích hoạt trong code fulfill thực tế

## 3) Những gì đã làm

### 3.1 Backend

- thêm [smm-panel.service.js](/e:/portfolio/server/src/services/smm-panel.service.js)
- mở provider `supplier_api` trong [marketplace-fulfillment.service.js](/e:/portfolio/server/src/services/marketplace-fulfillment.service.js)
- cho phép order input động:
  - `targetLink`
  - `quantity`
  - `comments`
- tạo external order sau khi thanh toán thành công
- lưu `externalOrderId`, `externalStatus`, `externalRaw` trong `fulfillmentPayload`
- thêm refresh thủ công trạng thái supplier theo order
- thêm scheduler nền để auto refresh các đơn `paid + processing + supplier_api`
- thêm service sync catalog từ panel vào `Category/Product`

### 3.2 FE

- public marketplace hiển thị form động cho sản phẩm `smm_panel`
- public marketplace tiếp tục theo dõi đơn supplier khi đã `paid + processing`
- public marketplace có khối tra cứu đơn bằng `payment_ref`
- admin product form cho phép tạo sản phẩm `supplier_api`
- admin có `Supplier Center` riêng để xem balance, queue đơn supplier và service list từ panel
- admin có thể sync từng service hoặc sync hàng loạt kết quả đang lọc
- admin có thể quét thủ công cả hàng đợi đơn supplier
- admin order table vẫn có nút refresh thủ công cho từng đơn supplier

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
  "lastCatalogSyncAt": "2026-04-24T10:00:00.000Z"
}
```

## 5) Flow hiện tại cho `smm_panel`

1. User chọn sản phẩm `supplier_api`.
2. User nhập `targetLink`, `quantity`, và `comments` nếu cần.
3. Hệ thống tạo đơn nội bộ `pending`.
4. User thanh toán QR hoặc bằng quỹ.
5. Sau khi xác nhận thanh toán, backend gọi supplier action `add`.
6. Nếu supplier trả về external order:
   - `status = paid`
   - `fulfillmentStatus = processing`
7. Scheduler nền sẽ quét các đơn supplier đang `processing` theo chu kỳ.
8. Admin vẫn có thể bấm refresh tay nếu muốn ép kiểm tra ngay.
9. Nếu supplier trả `Completed`:
   - `fulfillmentStatus = delivered`
10. Nếu supplier trả `Partial` hoặc `Canceled`:
   - `fulfillmentStatus = manual_review`

## 6) Các endpoint hiện có

- `GET /api/admin/supplier/smm-panel/services`
- `GET /api/admin/supplier/smm-panel/balance`
- `POST /api/admin/supplier/smm-panel/sync-services`
- `POST /api/admin/supplier/smm-panel/refresh-processing`
- `POST /api/admin/orders/:id/refresh-fulfillment`
- `GET /api/orders/:payment_ref`

## 7) Biến môi trường cần có

- `MARKET_SMM_PANEL_URL`
- `MARKET_SMM_PANEL_KEY`
- `MARKET_SMM_PANEL_TIMEOUT_MS` (optional)
- `MARKET_SUPPLIER_SYNC_ENABLED` (optional)
- `MARKET_SUPPLIER_SYNC_INTERVAL_MS` (optional)
- `MARKET_SUPPLIER_SYNC_BATCH_SIZE` (optional)
- `MARKET_SUPPLIER_MIN_SYNC_AGE_MS` (optional)

## 8) Những gì vẫn chưa làm

- xử lý hoàn tiền hoặc credit tự động cho `Partial/Canceled`
- sync catalog sâu hơn như disable service cũ, xóa map, hoặc diff rõ ràng
- email/status update riêng cho supplier async order
- provider `digital_code/card`

## 9) Ghi chú cho phase thẻ cào

Khi làm thẻ cào hoặc mã số giao ngay, không nên nhét chung business logic với `smm_panel`.

Nên xem đó là nhánh riêng:

- `supplier_api + supplierKind = digital_code`

Vì loại này thường cần:

- nhận mã/secret để giao ngay
- email delivery rõ ràng
- ẩn dữ liệu nhạy cảm
- chống lộ mã
- logic tồn kho / reserve / claim rất khác `smm_panel`
