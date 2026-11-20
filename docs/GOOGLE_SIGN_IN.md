# Đăng nhập Google cho website member

Tích hợp này áp dụng cho trang member trên website chính (`/dang-nhap`), **không áp dụng cho Admin Portal**. Google account chỉ tạo/liên kết member account; không bao giờ tự nhận quyền `owner`, `editor`, hoặc `support`.

## 1. Google Cloud Console

Trong dự án Google Cloud hiện tại, mở **Google Auth Platform**.

1. Ở **Branding**, điền tên app, email support, logo (nếu có), homepage `https://nguyenquangson.id.vn`, privacy policy và terms URL đang dùng trên website.
2. Ở **Audience**, chọn External hoặc Internal theo loại tài khoản Google được phép đăng nhập. Nếu trạng thái là Testing, thêm email của bạn trong **Test users**.
3. Ở **Data Access**, không cần thêm sensitive scope. Google Sign-In này chỉ dùng OpenID Connect cơ bản (`openid`, `email`, `profile`).
4. Vào **Clients** → **Create client**:
   - **Application type:** `Web application`
   - **Name:** ví dụ `portfolio-web-production`
   - **Authorized JavaScript origins:** `https://nguyenquangson.id.vn`
   - Khi chạy local, thêm riêng `http://localhost:5173` (hoặc port Vite thực tế), không thay origin production.
   - **Authorized redirect URIs:** để trống cho integration hiện tại. Nút dùng Google Identity Services popup và gửi ID token về API, không dùng redirect URI.
5. Nhấn **Create**, copy **Client ID** có dạng `...apps.googleusercontent.com`. Client ID có thể xuất hiện trong frontend; không copy hoặc dùng Client Secret cho flow này.

Ở ảnh bạn gửi, giá trị origin `https://nguyenquangson.id.vn` là đúng. Chỉ cần cuộn xuống và để phần redirect URI trống trước khi Create.

## 2. Cấu hình biến môi trường

Trên server API:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
JWT_SECRET=a-long-random-server-secret
```

Trong file environment của **client** trước khi build:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_API_BASE_URL=https://api.nguyenquangson.id.vn/api
```

Hai Client ID phải giống nhau. Sau khi đổi `VITE_GOOGLE_CLIENT_ID`, build/redeploy client lại vì biến Vite được nhúng lúc build. Không commit `.env`, Client Secret, hoặc service-account JSON.

## 3. Database migration

Chạy migration thủ công theo `server/scripts/sql/cms-editor-migration.sql`; script thêm `user_profiles.google_sub` và unique index idempotent. Không chạy migration trực tiếp lên production trước khi backup và thử staging.

## 4. Kiểm tra sau deploy

1. Mở `/dang-nhap`; nút Google chỉ hiển thị khi `VITE_GOOGLE_CLIENT_ID` có mặt.
2. Đăng nhập Google với một email mới: hệ thống tạo member, profile và wallet số dư 0.
3. Đăng nhập Google với email đã đăng ký password: hệ thống liên kết `google_sub` vào member hiện có, không tạo account/wallet thứ hai.
4. Thử ID token tạo cho OAuth client khác: API phải trả 401.
5. Vào `/tai-khoan` xác nhận thông tin account, sau đó logout/login lại.
6. Xác nhận Google account không thể truy cập `/admin`; Admin Portal vẫn cần admin token/password hiện hữu.

## Khắc phục lỗi thường gặp

- **`The given origin is not allowed` / button không hiển thị:** kiểm tra origin chính xác tuyệt đối trong Google Cloud, gồm scheme và port; không thêm dấu `/` cuối.
- **`Máy chủ chưa cấu hình GOOGLE_CLIENT_ID`:** biến môi trường server chưa được deploy hoặc server chưa restart.
- **`Google credential không hợp lệ`:** Client ID frontend/server không khớp, token hết hạn, hoặc origin không được cho phép.
- **App đang Testing:** thêm Google email đang thử nghiệm ở Audience → Test users.