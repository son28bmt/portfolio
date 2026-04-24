# Supplier API Notes

Tình trạng tài liệu: chuyển lại sang Markdown sạch từ bản nguồn [Api.docx](/e:/portfolio/server/docs/Api.docx) ngày `2026-04-24`.

Ghi chú bảo mật:

- không lưu API key thật trong file này
- cấu hình thật phải đi qua biến môi trường

## 1) Base config

- Endpoint URL: `https://www.smmlikevip.com/api/v2`
- HTTP Method: `POST`
- Content-Type: `application/x-www-form-urlencoded`
- Response format: `JSON`

Biến môi trường backend nên dùng:

- `MARKET_SMM_PANEL_URL`
- `MARKET_SMM_PANEL_KEY`
- `MARKET_SMM_PANEL_TIMEOUT_MS`

## 2) Nhóm API cốt lõi

### 2.1 Services

Dùng để đồng bộ danh sách dịch vụ từ panel về hệ thống nội bộ.

Request:

- `key`
- `action=services`

Response mẫu:

```json
[
  {
    "service": 1,
    "name": "Facebook cảm xúc Like",
    "type": "Default",
    "category": "FB Like",
    "rate": "15000",
    "min": "200",
    "max": "10000",
    "refill": true,
    "cancel": false
  }
]
```

Ghi chú về `rate`:

- với `Default`, `Custom Comments`, `Mentions Hashtag`, `SEO`: `rate` là giá cho `1.000` lượt
- với `Package`, `Subscriptions`, `Custom Comments Package`: `rate` là giá cho `1` lượt hoặc `1` gói

### 2.2 Balance

Dùng để lấy số dư ví vốn ở panel.

Request:

- `key`
- `action=balance`

Response mẫu:

```json
{
  "balance": "100.84292",
  "currency": "VND"
}
```

### 2.3 Add order

Dùng để tạo đơn supplier sau khi hệ thống nội bộ đã xác nhận thanh toán.

Request:

- `key`
- `action=add`
- `service`
- `link`
- `quantity`
- `comments` nếu loại dịch vụ yêu cầu

Response mẫu:

```json
{
  "order": 23501
}
```

Ghi chú:

- phải lưu `order` này thành `externalOrderId`

### 2.4 Order status

Dùng để kiểm tra trạng thái một đơn supplier.

Request:

- `key`
- `action=status`
- `order`

Response mẫu:

```json
{
  "charge": "15000",
  "start_count": "3572",
  "status": "Completed",
  "remains": "0"
}
```

Trạng thái có thể gặp:

- `Pending`
- `Processing`
- `In progress`
- `Completed`
- `Partial`
- `Canceled`

Mapping hiện tại trong code:

- `Completed` -> `delivered`
- `Pending` / `Processing` / `In progress` -> `processing`
- `Partial` / `Canceled` -> `manual_review`

## 3) Nhóm API nâng cao

### 3.1 Multiple orders status

- `action=status`
- `orders=123,456,789`

### 3.2 Cancel

- `action=cancel`
- `orders=...`

Chỉ dùng được với dịch vụ có `cancel=true`.

### 3.3 Refill

- `action=refill`
- `order=...`

Response mẫu:

```json
{
  "refill": "1"
}
```

### 3.4 Refill status

- `action=refill_status`
- `refill=...`

Trạng thái có thể gặp:

- `Completed`
- `Rejected`
- `Refill not found`

## 4) Liên hệ với kiến trúc hiện tại

API này đang được map vào nhánh:

- `sourceType = supplier_api`
- `supplierKind = smm_panel`

Nó không phải nhánh `digital_code/card`.

Vì vậy:

- đơn hàng là async
- cần polling hoặc refresh trạng thái
- không có payload giao ngay kiểu mã thẻ / tài khoản / secret

## 5) Những gì vẫn cần làm tiếp

- sync `services` từ panel vào admin UI tốt hơn
- auto refresh trạng thái supplier thay vì chỉ refresh tay
- xử lý tài chính cho `Partial` / `Canceled`
- hỗ trợ `cancel` / `refill`
- mở nhánh `digital_code/card` ở phase sau
