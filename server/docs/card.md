# Card Partner API

## Mục tiêu

Tài liệu này mô tả phase 1 của lane `card / mã số` trong marketplace:

- đồng bộ catalog thẻ cào từ nhà cung cấp vào admin
- tạo order QR như các sản phẩm marketplace khác
- sau khi thanh toán, hệ thống gọi API `buycard`
- nếu lấy được thẻ ngay thì giao serial/code cho khách
- nếu nhà cung cấp trả về `status = 2` thì treo đơn ở `processing` và dùng `redownload`
- nếu ví nhà cung cấp không đủ tiền thì treo đơn ở `manual_review`

Hiện tại phase này đã có cả backend lẫn giao diện cơ bản ở client/admin để vận hành thực tế.

## Cấu hình `.env`

Thêm các biến mới vào `server/.env`:

```env
CARD_PROVIDER_BASE_URL=https://tenmien.com/api/cardws
CARD_PROVIDER_PARTNER_ID=0299338261
CARD_PROVIDER_PARTNER_KEY=your_partner_key
CARD_PROVIDER_WALLET_NUMBER=0081083966
CARD_PROVIDER_TIMEOUT_MS=15000
```

Ghi chú:

- `CARD_PROVIDER_BASE_URL` đang dùng dạng có đuôi `/api/cardws`
- `products` sẽ được gọi qua `GET {BASE_URL}/products?partner_id=...`
- chữ ký `sign` được tạo theo công thức:
  - `md5(partner_key + partner_id + command + request_id)`
- với các hàm không có `request_id`, hệ thống dùng chuỗi rỗng `""`

## API nhà cung cấp đang sử dụng

### POST `/api/cardws`

Lệnh được gửi qua field `command`:

- `buycard`
- `checkavailable`
- `redownload`
- `getbalance`

### GET `/api/cardws/products?partner_id=...`

Trả về catalog card thật để sync vào hệ thống.

## Mapping vào marketplace

Mỗi sản phẩm card sau khi sync sẽ được lưu thành:

- `sourceType = supplier_api`
- `sourceConfig.supplierKind = digital_code`
- `sourceConfig.providerCode = card_partner`
- `sourceConfig.cardProviderCode = card_partner`
- `sourceConfig.serviceCode = ...`
- `sourceConfig.cardValue = ...`

Danh mục tạo từ catalog sẽ mặc định:

- `storeSection = card`

## Giao diện hiện tại

### Client storefront

Route mua card đã hoạt động tại:

- `/cua-hang/card`

Trang này hiện có:

- lọc theo nhà mạng / nhóm card
- tìm kiếm theo tên, serviceCode, mệnh giá
- checkout QR
- thanh toán bằng quỹ nội bộ
- tra cứu đơn và sao chép lại mã đã giao

### Admin

Trong admin marketplace:

- tab `Nhà cung cấp` đã có thêm khối card partner
- tab `Sản phẩm` đã hỗ trợ tạo sản phẩm `digital_code/card`

## Admin endpoints

### Xem catalog card từ nhà cung cấp

`GET /api/admin/supplier/card-partner/products`

Trả về dữ liệu catalog đã normalize để admin xem nhanh.

### Xem số dư nhà cung cấp

`GET /api/admin/supplier/card-partner/balance`

Trả về:

- `balance`
- `currency`
- `raw`

### Đồng bộ catalog vào admin

`POST /api/admin/supplier/card-partner/sync-products`

Body co the gui:

```json
{
  "rateMultiplier": 1,
  "markupPercent": 0,
  "markupFixed": 0,
  "updateExisting": true,
  "onlyCreate": false
}
```

Ý nghĩa:

- `rateMultiplier`: hệ số nhân giá vốn
- `markupPercent`: cộng thêm lời theo phần trăm
- `markupFixed`: cộng thêm số tiền cố định
- `updateExisting`: cho phép cập nhật sản phẩm đã tồn tại
- `onlyCreate`: chỉ tạo mới, không sửa sản phẩm cũ

## Vòng đời order card

### 1. Tạo order

Khách tạo order như flow marketplace QR hiện tại.

Khi tạo order:

- hệ thống validate sản phẩm card đã cấu hình đầy đủ
- hệ thống `checkavailable` trước
- nếu hết hàng, order sẽ bị chặn từ đầu

### 2. Khách thanh toán thành công

Webhook order nhận giao dịch `ORD...` như bình thường.

Sau khi nhận tiền:

- hệ thống gọi `buycard`
- `request_id` = `payment_ref` của đơn hàng

### 3. Case thành công ngay

Nếu nhà cung cấp trả:

- `status = 1`

Hệ thống sẽ:

- chuyển đơn sang `status = paid`
- `fulfillmentStatus = delivered`
- lưu `externalOrderId`
- lưu danh sách `cards`
- sinh `deliveryText`

Khách có thể xem thông tin thẻ trong trang tra cứu đơn.

### 4. Case đã trừ tiền nhưng chưa lấy được thẻ

Nếu nhà cung cấp trả:

- `status = 2`

Hệ thống sẽ:

- chuyển đơn sang `status = paid`
- `fulfillmentStatus = processing`
- lưu `externalOrderId`
- đánh dấu `lifecycle = awaiting_redownload`

Lúc này scheduler refresh supplier sẽ dùng `redownload` để tải lại thẻ.

### 5. Case ví nhà cung cấp không đủ tiền

Nếu nhà cung cấp trả:

- `status = 102`

Hệ thống sẽ:

- giữ đơn ở `status = paid`
- chuyển `fulfillmentStatus = manual_review`
- lưu `code = supplier_balance_low`
- lưu `lastError`

Đây là case admin phải xử lý tay:

- nạp thêm tiền vào ví nhà cung cấp
- vào admin marketplace
- bấm `refresh fulfillment` để chạy tiếp

### 6. Case hết hàng / lỗi cần xử lý tay

Một số mã lỗi sẽ được đưa vào `manual_review`, vì khách đã thanh toán rồi:

- `118` het hang
- `109` request id bi trung
- `114` sai IP dang ky
- `116` sai chu ky
- `121`, `122`, `123`, `124`

Lúc này admin cần:

- kiểm tra lại cấu hình provider
- đổi sản phẩm / hoàn tiền / gửi lại sau

## Refresh và retry

Lần refresh đơn card dùng chung flow `refresh fulfillment` của marketplace.

Nếu đơn đang ở:

- `processing` vi `status = 2`
- `manual_review` vi thieu tien supplier

admin có thể retry lại sau khi đã xử lý bên nhà cung cấp.

Backend sẽ:

- gọi `redownload` nếu đã có `externalOrderId`
- cập nhật `cards`, `deliveryText`, `externalStatus`

## Mapping trạng thái provider

| Status provider | Mapping he thong |
| --- | --- |
| `1` | `paid + delivered` |
| `2` | `paid + processing` |
| `102` | `paid + manual_review` + `supplier_balance_low` |
| `118` | `paid + manual_review` |
| loi khac sau khi da tru tien | `paid + manual_review` |

## File chính

- `server/src/services/card-partner.service.js`
- `server/src/services/marketplace-card-sync.service.js`
- `server/src/services/marketplace-fulfillment.service.js`
- `server/src/controllers/marketplace.controller.js`
- `server/src/routes/marketplace.routes.js`
- `client/src/pages/MarketplaceCards.jsx`
- `admin/src/pages/Marketplace/components/TabSupplier.jsx`
- `admin/src/pages/Marketplace/components/TabProducts.jsx`

## Giới hạn phase 1

Hiện tại đã có:

- sync catalog card
- xem số dư provider
- order QR -> buy card
- redownload khi nhà cung cấp trả `status = 2`
- manual review khi ví nhà cung cấp không đủ tiền
- UI client `/cua-hang/card`
- UI admin cơ bản cho sync và vận hành

Hiện tại chưa làm xong:

- dashboard/chỉ số riêng cho lane card
- màn hình admin chuyên biệt hơn cho từng provider card
- tự động hoàn tiền/credit nếu đơn card thất bại và không thể xử lý tiếp
- đồng bộ chọn lọc theo từng product/value ngay trong API sync
