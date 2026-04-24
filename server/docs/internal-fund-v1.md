# Quỹ Nội Bộ V1

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-25`.

Tài liệu này là source of truth cho lane `member / wallet / benefits`.  
`marketplace.md` chỉ mô tả marketplace core và phải tham chiếu lại tài liệu này khi nói về tài khoản, quỹ nội bộ và ưu đãi.

## 1) Mục tiêu

Xây lớp member tối thiểu để:

- khách vẫn mua được bằng QR mà không cần đăng nhập
- user đã đăng nhập có thể nạp quỹ nội bộ
- user dùng quỹ để mua sản phẩm số
- user xem được hồ sơ, số dư, sổ cái và lịch sử mua
- admin có màn quan sát cơ bản cho member, topup và ledger

## 2) Quyết định đã chốt

1. `guest checkout` vẫn là lane mặc định.
2. Không ép tạo tài khoản trong checkout.
3. Đăng nhập/đăng ký là để dùng quỹ, giữ lịch sử mua và mở đường cho ưu đãi.
4. Quỹ nội bộ chỉ dùng trong hệ thống, chưa hỗ trợ rút tiền ở V1.
5. V1 tiếp tục dùng SePay và webhook ngân hàng hiện có.
6. Wallet phải đi lane webhook riêng, không dùng donate route để đỡ hộ nữa.

## 3) Phạm vi V1 hiện tại

### 3.1 Đã có trong code

- `POST /api/auth/register` cho user thường
- `GET /api/account/me`
- `PUT /api/account/me`
- `PUT /api/account/password`
- `GET /api/wallet/me`
- `GET /api/wallet/ledger`
- `POST /api/wallet/topups`
- `GET /api/wallet/topups/:id/status`
- `POST /api/wallet/checkout`
- `GET /api/wallet/purchases`
- `POST /api/wallet/webhook/sepay`
- admin API:
  - `GET /api/admin/wallet/users`
  - `GET /api/admin/wallet/topups`
  - `GET /api/admin/wallet/ledger`
- admin dashboard summary:
  - `GET /api/admin/dashboard/summary`
- FE user:
  - đăng nhập
  - đăng ký
  - trang tài khoản
  - tạo lệnh nạp quỹ
  - xem trạng thái topup
  - xem ledger
  - xem lịch sử mua bằng quỹ
  - thanh toán bằng quỹ ngay trong shop
- FE admin:
  - tab `Quỹ nội bộ`
  - xem members
  - xem topups
  - xem ledger
  - lọc cơ bản
  - dashboard có tổng tiền đã nhận, tách donate / wallet / order

### 3.2 Chưa xong

- 2FA
- quản lý phiên đăng nhập
- logout current session / logout all
- admin adjust số dư thủ công
- admin manual review cho topup bất thường
- link đơn guest cũ với tài khoản mới
- tier benefits / promo / campaign thật
- test tích hợp đầy đủ cho wallet + webhook + checkout flow

## 4) Thiết kế nghiệp vụ hiện tại

### 4.1 Hai lane song song

- `guest checkout`
- `member benefits`

Lane member được cộng thêm dần tính năng nhưng không được làm hỏng lane guest.

### 4.2 Nguyên tắc bắt buộc

1. Chỉ cộng quỹ sau khi webhook verify thành công.
2. Mọi biến động số dư phải đi qua ledger.
3. Không cho số dư âm.
4. Wallet checkout phải chạy trong transaction và lock số dư.
5. Topup phải chống xử lý trùng.
6. Nếu user chuyển khoản lặp lại vào cùng một `paymentRef`, hệ thống chỉ ghi nhận lần hợp lệ đầu tiên; các lần sau là case vận hành thủ công, không auto cộng lặp.

## 5) Schema và model

### 5.1 Bảng/model

- `user_profiles`
- `wallet_accounts`
- `wallet_ledger_entries`
- `wallet_topups`

### 5.2 Mở rộng trên `orders`

- `user_id`
- `wallet_ledger_entry_id`
- `payment_method`

Ghi chú:

- `payment_method` hiện có `qr` và `wallet`
- đơn trả bằng quỹ vẫn dùng chung bảng `orders`

## 6) Luồng đang chạy

### 6.1 Luồng A: mua nhanh bằng QR

1. User chọn sản phẩm.
2. Tạo đơn `pending`.
3. SePay xác nhận qua webhook order.
4. Marketplace fulfillment giao hàng.

Trạng thái:

- đang chạy
- vẫn là lane mặc định
- đã có CTA mềm kéo user sang đăng nhập/đăng ký sau khi mua

### 6.2 Luồng B: nạp quỹ

1. User đăng nhập.
2. Tạo topup `pending`.
3. Hệ thống sinh `paymentRef` với prefix quỹ.
4. User chuyển khoản đúng nội dung.
5. Webhook wallet xác nhận.
6. Ghi ledger `credit`.
7. Cập nhật số dư ví.

Trạng thái:

- đang chạy
- dùng endpoint riêng `POST /api/wallet/webhook/sepay`

### 6.3 Luồng C: mua bằng quỹ

1. User đăng nhập.
2. Chọn sản phẩm.
3. Hệ thống kiểm tra số dư và readiness của fulfillment source.
4. Ghi ledger `debit`.
5. Tạo đơn `paid`.
6. Fulfill theo marketplace provider.

Trạng thái:

- đang chạy
- dùng được với lane local stock
- dùng được mức đầu với lane supplier `smm_panel`

## 7) Ghi chú vận hành quan trọng

### 7.1 Webhook production

Hiện tại nên cấu hình tách riêng:

- donate: `POST /api/donate/webhook/sepay`
- wallet: `POST /api/wallet/webhook/sepay`
- order: `POST /api/order/webhook/sepay`

Wrong-lane webhook nên trả `ignored`, không fail cứng.

### 7.2 Rollout production

Trước khi gọi là “đã lên production ổn”, phải đảm bảo:

1. deploy backend mới
2. restart process Node/PM2
3. schema DB đã có đủ cột mới, nhất là `orders.payment_method`
4. SePay đang trỏ đúng từng webhook lane

## 8) Đánh giá hiện tại

V1 chưa phải “xong hết”.

Trạng thái hợp lý hiện nay:

- `wallet/member core`: usable
- `admin wallet ops`: mới ở mức quan sát + lọc cơ bản
- `security/member ops`: chưa xong
- `production hardening`: còn thiếu checklist triển khai và test tích hợp sâu

## 9) Các điểm còn yếu cần note rõ

1. Chưa có 2FA và session management, nên không được overclaim security hoàn chỉnh.
2. Admin wallet chưa đủ công cụ xử lý case thực tế như adjust, manual review, hoàn tiền thủ công.
3. Chưa có cơ chế tốt cho duplicate transfer vào cùng một mã topup ngoài việc từ chối auto-credit lần hai.
4. Rủi ro production hiện lớn nhất không nằm ở business logic mà nằm ở deploy cũ, route cũ và thiếu cột DB.

## 10) Definition of done hợp lý cho V1

Có thể coi V1 “ổn để chạy” khi:

1. guest checkout QR không regress
2. account / wallet / topup / ledger / purchase hoạt động ổn trên môi trường thật
3. webhook wallet chạy đúng lane riêng
4. admin xem được member / topup / ledger / dashboard summary
5. docs phản ánh đúng trạng thái thật, không overclaim

## 11) Phase tiếp theo sau V1

### Phase 1.5: làm cho V1 vận hành đỡ đau hơn

- test tích hợp wallet flow
- admin export / lọc sâu hơn
- xử lý vận hành cho duplicate transfer
- checklist deploy production rõ ràng hơn

### Phase 2: security và member operations

- 2FA
- session management
- logout current / logout all
- admin adjust / manual review
- guest-to-member linking

### Phase 3: benefits thật sự

- tier
- promo / campaign
- loyalty / retention

### Phase 4: supplier API và lane card

- xem `marketplace-v1-v2-roadmap.md`
