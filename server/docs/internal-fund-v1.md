# Quỹ Nội Bộ V1

Tình trạng tài liệu: cập nhật theo code hiện tại ngày `2026-04-24`.

Tài liệu này là source of truth cho lane `member benefits / internal fund`.
`marketplace.md` chỉ mô tả phần marketplace core và phải tham chiếu lại tài liệu này khi nói về user, wallet và ưu đãi.

## 1) Mục tiêu

Xây dựng lớp tài khoản thành viên tối thiểu để:

- khách vẫn mua được bằng QR mà không cần đăng nhập
- user đã đăng nhập có thể nạp quỹ nội bộ
- user dùng quỹ để mua sản phẩm số
- user xem được hồ sơ, số dư, lịch sử sổ cái, lịch sử mua gần đây
- admin có màn quan sát cơ bản cho member, topup và ledger

## 2) Quyết định đã chốt

1. Guest checkout vẫn là luồng mặc định.
2. Không ép tạo tài khoản trong checkout.
3. Đăng nhập/đăng ký là để dùng quỹ, giữ lịch sử mua và mở đường cho ưu đãi về sau.
4. Quỹ là quỹ nội bộ, chỉ dùng để mua trong hệ thống, không hỗ trợ rút tiền mặt.
5. V1 dùng lại tích hợp SePay hiện có, không mở cổng thanh toán mới.

## 3) Phạm vi V1 thực tế

### 3.1 Đã làm

- Mở lại `POST /api/auth/register` cho user thường.
- Có `GET/PUT /api/account/me` và `PUT /api/account/password`.
- Có `GET /api/wallet/me`.
- Có `GET /api/wallet/ledger`.
- Có `POST /api/wallet/topups`.
- Có `GET /api/wallet/topups/:id/status`.
- Có `POST /api/wallet/checkout`.
- Có `GET /api/wallet/purchases`.
- Có `POST /api/wallet/webhook/sepay`.
- Có admin API read-only:
  - `GET /api/admin/wallet/users`
  - `GET /api/admin/wallet/topups`
  - `GET /api/admin/wallet/ledger`
- FE public đã có:
  - đăng nhập
  - đăng ký
  - trang tài khoản
  - nạp quỹ
  - lịch sử ledger
  - lịch sử mua bằng quỹ
  - thanh toán bằng quỹ ngay trong marketplace
- FE admin đã có tab `Quỹ nội bộ` để xem `members`, `topups`, `ledger`.

### 3.2 Chưa làm

- 2FA khi đăng nhập.
- quản lý phiên đăng nhập.
- đăng xuất phiên hiện tại / tất cả phiên.
- admin `adjust` số dư thủ công.
- admin manual review cho topup bất thường.
- liên kết đơn guest cũ với tài khoản sau khi user đăng ký.
- rule ưu đãi, tier benefits, promo/campaign thực tế.
- test end-to-end đầy đủ cho wallet/topup/webhook/purchase flow.

## 4) Thiết kế nghiệp vụ hiện tại

### 4.1 Hai lane song song

- `guest checkout`
- `member benefits`

Lane thứ hai được cộng dần tính năng, nhưng không được làm hỏng lane thứ nhất.

### 4.2 Nguyên tắc bắt buộc

1. Chỉ cộng quỹ sau khi webhook nạp được verify và xác nhận thành công.
2. Mọi biến động quỹ phải đi qua ledger.
3. Không cho số dư âm.
4. Checkout bằng quỹ phải dùng transaction và row lock.
5. Topup và wallet checkout phải có idempotency / chống xử lý trùng.
6. Quỹ nội bộ không có chức năng rút tiền trong V1.

## 5) Schema và mô hình đã có trong code

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

- `payment_method` hiện có `qr` và `wallet`.
- đơn thanh toán bằng quỹ vẫn dùng chung `orders`, không tạo hệ thống đơn riêng.

## 6) Luồng V1 đang chạy

### 6.1 Luồng A: mua nhanh bằng QR

1. User chọn sản phẩm.
2. Tạo đơn `pending`.
3. SePay webhook xác nhận.
4. Marketplace fulfillment giao hàng.

Trạng thái hiện tại:

- đã chạy
- vẫn là lane mặc định
- đã có CTA mềm sau khi hoàn tất để kéo sang đăng nhập/đăng ký

### 6.2 Luồng B: nạp quỹ

1. User đăng nhập.
2. Tạo topup `pending`.
3. Hệ thống sinh `paymentRef` theo prefix quỹ.
4. User chuyển khoản đúng nội dung.
5. Webhook xác nhận thành công.
6. Ghi ledger `credit`.
7. Cập nhật số dư quỹ.

Trạng thái hiện tại:

- đã chạy
- đang dùng endpoint riêng `POST /api/wallet/webhook/sepay`

### 6.3 Luồng C: mua bằng quỹ

1. User đăng nhập.
2. Chọn sản phẩm.
3. Hệ thống kiểm tra số dư ví và tính sẵn sàng của fulfillment source.
4. Ghi ledger `debit`.
5. Tạo đơn `paid`.
6. Giao hàng số ngay.

Trạng thái hiện tại:

- đã chạy
- mới hỗ trợ nguồn fulfill hiện tại của marketplace V1

## 7) Trạng thái giao diện

### 7.1 FE user

Đã có:

- `/dang-nhap`
- `/dang-ky`
- `/tai-khoan`
- hiển thị số dư quỹ
- tạo lệnh nạp và theo dõi trạng thái
- đổi mật khẩu
- xem ledger
- xem lịch sử mua bằng quỹ
- wallet checkout trong trang marketplace

Chưa có:

- trang bảo mật riêng
- màn 2FA
- quản lý phiên
- CTA rõ ràng sau guest checkout thành công

### 7.2 FE admin

Đã có:

- tab `Quỹ nội bộ` trong marketplace manager
- xem danh sách member
- xem topup
- xem ledger
- tìm member theo username/email/họ tên
- lọc topup theo trạng thái
- lọc ledger theo loại

Chưa có:

- thao tác adjust số dư
- manual review
- filter sâu, search sâu, export
- màn quản trị member benefits riêng

## 8) Review nhanh: V1 đã ổn hết chưa?

Chưa.

V1 hiện ở trạng thái:

- `marketplace core`: dùng được
- `wallet/member core`: dùng được ở mức bản đầu
- `security/member operations`: chưa xong
- `admin operations`: mới ở mức quan sát cơ bản

## 9) Các gap cần note rõ trước khi coi là “ổn”

1. Docs cũ từng ghi 2FA và session management là bắt buộc trong V1, nhưng code hiện chưa có. Từ bây giờ phải xem đây là backlog, không được mô tả như đã xong.
2. Admin wallet hiện vẫn là read-only, chưa đủ cho vận hành khi có case bất thường.
3. Chưa có test tích hợp đầy đủ cho topup webhook và wallet checkout.

## 10) Definition of done hợp lý cho V1

Có thể coi V1 “ổn để chạy” khi:

1. Guest checkout QR vẫn chạy ổn và không bị regress.
2. Register/login/account/wallet hoạt động ổn trên môi trường thật.
3. Topup QR -> webhook -> ledger -> balance hoạt động ổn.
4. Wallet checkout -> order paid -> fulfill -> email hoạt động ổn.
5. Admin nhìn được member/topup/ledger.
6. Docs phản ánh đúng trạng thái thật, không overclaim 2FA/session/admin ops.

## 11) Phase tiếp theo sau V1

### Phase 1.5: làm cho V1 “vận hành được”

- thêm kiểm thử tích hợp cho wallet flow
- bổ sung phân trang/export tốt hơn cho admin wallet
- rà soát message tiếng Việt và docs

### Phase 2: security và member operations

- 2FA
- session management
- logout current / logout all
- admin adjust / manual review
- liên kết đơn guest với account

### Phase 3: benefits thực sự

- tier benefits
- promo/campaign
- loyalty / retention logic

### Phase 4: V2 supplier API

- không thuộc tài liệu này
- xem thêm `marketplace-v1-v2-roadmap.md`
