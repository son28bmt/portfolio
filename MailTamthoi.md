Tổng quan API
API vận hành theo mô hình action-based, truy cập qua endpoint chung /ajax.php và tham số f. Dành cho các luồng tạo mailbox tạm, đồng bộ thư, đọc chi tiết email và quản lý dữ liệu thư.

Base: /ajax.php
Health: /health
Auth: sid_token
Bắt đầu nhanh
Bước 1: Gọi GET /ajax.php?f=get_domains để lấy danh sách domain.
Bước 2: Gọi POST /ajax.php?f=get_email_address để tạo session và email tạm.
Bước 3 (tùy chọn): Gọi POST /ajax.php?f=set_email_user để đổi username/domain theo ý muốn.
Bước 3b (tùy chọn): Gọi POST /ajax.php?f=open_email_address để mở lại mailbox cũ đã tồn tại.
Bước 4: Poll POST /ajax.php?f=get_email_list theo chu kỳ 3-10 giây.
Bước 5: Khi mở thư, gọi POST /ajax.php?f=fetch_email để lấy nội dung đầy đủ.
Bước 6: Nếu có tệp đính kèm, gọi POST /ajax.php?f=fetch_attachment để tải file.
Xác thực phiên
Sau khi gọi get_email_address thành công, hệ thống trả về sid_token. Token này bắt buộc cho các action liên quan mailbox.

Bảo mật: với các action POST, gửi sid_token trong tham số body. Không truyền sid_token trên query string URL.

Các response có mang ngữ cảnh session như get_email_address, set_email_user, open_email_address và get_email_list cũng trả thêm metadata phiên để client theo dõi hạn dùng của session.

Trường	Bắt buộc	Mô tả
sid_token	Có	Chuỗi 48 ký tự hex đại diện cho session đang hoạt động.
lang	Không	Ngôn ngữ gợi ý, hỗ trợ vi hoặc en.
Session meta trong JSON response	Kiểu	Mô tả
session_started_at	number	Unix timestamp (mili giây) thời điểm session được tạo.
session_expires_at	number	Unix timestamp (mili giây) thời điểm session hiện tại sẽ hết hạn.
session_ttl_minutes	number	TTL cấu hình của session theo phút.
mailbox_event_token	string	Token dùng cho mailbox event stream thời gian thực. Nếu chỉ poll inbox thì có thể bỏ qua.
Các action mailbox đọc/truy xuất như get_email_list, fetch_email, del_email và fetch_attachment cũng gửi metadata session mới nhất qua response header.

Response header	Kiểu	Mô tả
X-Session-Started-At	number	Unix timestamp (mili giây) thời điểm session được tạo.
X-Session-Expires-At	number	Unix timestamp (mili giây) thời điểm session được gia hạn gần nhất sẽ hết hạn.
X-Session-Ttl-Minutes	number	TTL session theo phút.
X-Mailbox-Event-Token	string	Mailbox event token mới nhất, nên đồng bộ lại nếu client dùng realtime mailbox events.
Lấy danh sách domain
GET
/ajax.php?f=get_domains
Trả về danh sách domain khả dụng, domain mặc định và thời điểm cập nhật catalog domain gần nhất.

{
  "domains": ["mailmmo.io.vn", "tempmailmmo.com"],
  "defaultDomain": "tempmailmmo.com",
  "domains_updated_at": 1710000000000
}
Schema response	Kiểu	Mô tả
domains	string[]	Danh sách domain khả dụng.
defaultDomain	string	Domain mặc định được chọn khi không chỉ định domain.
domains_updated_at	number	Unix timestamp (mili giây) của lần đồng bộ catalog domain gần nhất.
Tạo mailbox tạm hoặc lấy lại session
POST
/ajax.php?f=get_email_address
Tạo mailbox mới, hoặc lấy lại session hiện tại nếu gửi sid_token hợp lệ trong tham số body.

Response cũng kèm catalog domain hiện tại để client có thể đồng bộ danh sách domain mà không cần gọi riêng get_domains.

Lưu ý: sid_token chỉ đại diện cho phiên truy cập tạm. Khi phiên hết hạn, mailbox không bị xóa ngay khỏi máy chủ và vẫn có thể mở lại bằng open_email_address nếu email hoặc domain đó còn tồn tại.

Tham số body	Bắt buộc	Mô tả
email_domain	Không	Domain mong muốn, nếu không có sẽ dùng defaultDomain.
lang	Không	Ngôn ngữ phiên, ví dụ vi hoặc en.
sid_token	Không	Gửi token cũ trong tham số body để lấy lại phiên nếu còn hiệu lực.
{
  "email_addr": "demo@tempmailmmo.com",
  "email_user": "demo123",
  "email_domain": "tempmailmmo.com",
  "sid_token": "0123456789abcdef0123456789abcdef0123456789abcdef",
  "alias": 0,
  "session_started_at": 1710000000000,
  "session_expires_at": 1710086400000,
  "session_ttl_minutes": 1440,
  "mailbox_event_token": "MAILBOX_EVENT_TOKEN",
  "domains": ["mailmmo.io.vn", "tempmailmmo.com"],
  "defaultDomain": "tempmailmmo.com",
  "domains_updated_at": 1710000000000
}
Schema response	Kiểu	Mô tả
email_addr	string	Địa chỉ email đầy đủ local@domain.
email_user	string	Phần local-part của email.
email_domain	string	Domain hiện tại của phiên.
sid_token	string (48 hex)	Token phiên dùng cho các action mailbox.
alias	number	Cờ tương thích, hiện trả 0.
session_started_at	number	Unix timestamp (mili giây) thời điểm session được tạo.
session_expires_at	number	Unix timestamp (mili giây) thời điểm session sẽ hết hạn nếu không có request mới.
session_ttl_minutes	number	TTL cấu hình của session theo phút.
mailbox_event_token	string	Token dùng cho mailbox event stream thời gian thực.
domains	string[]	Danh sách domain khả dụng hiện tại.
defaultDomain	string	Domain mặc định hiện tại của hệ thống.
domains_updated_at	number	Unix timestamp (mili giây) của lần đồng bộ catalog domain gần nhất.
Lấy danh sách email
POST
/ajax.php?f=get_email_list
Lấy danh sách email theo sid_token trong tham số body, hỗ trợ phân trang bằng offset.

Response cũng kèm catalog domain mới nhất để client đang hoạt động có thể đồng bộ ngay khi danh sách domain thay đổi.

Endpoint này đồng thời gia hạn session và trả cả session meta trong JSON response lẫn response header.

Tham số body	Bắt buộc	Mô tả
sid_token	Có	Token phiên đang hoạt động (gửi trong tham số body).
offset	Không	Vị trí bắt đầu lấy dữ liệu, mặc định là 0.
{
  "list": [],
  "count": 0,
  "session_started_at": 1710000000000,
  "session_expires_at": 1710086400000,
  "session_ttl_minutes": 1440,
  "mailbox_event_token": "MAILBOX_EVENT_TOKEN",
  "domains": ["mailmmo.io.vn", "tempmailmmo.com"],
  "defaultDomain": "tempmailmmo.com",
  "domains_updated_at": 1710000000000
}
Schema response	Kiểu	Mô tả
list	object[]	Danh sách email theo trang.
count	number	Số phần tử hiện có trong list.
session_started_at	number	Unix timestamp (mili giây) thời điểm session được tạo.
session_expires_at	number	Unix timestamp (mili giây) thời điểm session đã được gia hạn sẽ hết hạn.
session_ttl_minutes	number	TTL cấu hình của session theo phút.
mailbox_event_token	string	Mailbox event token mới nhất sau khi session được gia hạn.
domains	string[]	Danh sách domain khả dụng hiện tại.
defaultDomain	string	Domain mặc định hiện tại của hệ thống.
domains_updated_at	number	Unix timestamp (mili giây) của lần đồng bộ catalog domain gần nhất.
Schema item trong list[]	Kiểu	Mô tả
mail_id	string	ID thư (ví dụ 123 hoặc Junk:123).
mail_from	string	Người gửi.
mail_subject	string	Tiêu đề thư.
mail_excerpt	string	Đoạn trích ngắn nội dung.
mail_timestamp	string	Unix timestamp (giây) dạng chuỗi.
mail_read	number	1 = đã đọc, 0 = chưa đọc.
attached	number	1 = có tệp đính kèm, 0 = không.
Đặt username/domain theo ý muốn
POST
/ajax.php?f=set_email_user
Cập nhật địa chỉ email theo username và domain chỉ định cho session hiện tại.

Nếu bật force_takeover và email mục tiêu đang do session khác giữ, API sẽ trả về session hiện đang sở hữu mailbox đó.

Tham số body	Bắt buộc	Mô tả
sid_token	Có	Token phiên đang hoạt động.
email_user	Có	Username 3-32 ký tự, chỉ gồm a-z, 0-9, dấu chấm, gạch dưới, gạch ngang.
email_domain	Không	Domain mục tiêu. Nếu không hợp lệ sẽ dùng domain mặc định.
force_takeover	Không	1/true để takeover email mục tiêu nếu email đó đang bị session khác giữ.
lang	Không	Ngôn ngữ phiên, hỗ trợ vi hoặc en.
{
  "email_addr": "custom_name@tempmailmmo.com",
  "email_user": "custom_name",
  "email_domain": "tempmailmmo.com",
  "sid_token": "0123456789abcdef0123456789abcdef0123456789abcdef",
  "alias": 0,
  "session_started_at": 1710000000000,
  "session_expires_at": 1710086400000,
  "session_ttl_minutes": 1440,
  "mailbox_event_token": "MAILBOX_EVENT_TOKEN",
  "domains": ["mailmmo.io.vn", "tempmailmmo.com"],
  "defaultDomain": "tempmailmmo.com",
  "domains_updated_at": 1710000000000
}
Schema response	Kiểu	Mô tả
email_addr	string	Địa chỉ email mới sau khi cập nhật.
email_user	string	Username hiện tại.
email_domain	string	Domain hiện tại.
sid_token	string (48 hex)	Token phiên giữ nguyên.
alias	number	Cờ tương thích, hiện trả 0.
session_started_at	number	Unix timestamp (mili giây) thời điểm session được tạo.
session_expires_at	number	Unix timestamp (mili giây) thời điểm session mới sẽ hết hạn.
session_ttl_minutes	number	TTL cấu hình của session theo phút.
mailbox_event_token	string	Mailbox event token mới nhất của session hiện tại.
domains	string[]	Danh sách domain khả dụng hiện tại.
defaultDomain	string	Domain mặc định hiện tại của hệ thống.
domains_updated_at	number	Unix timestamp (mili giây) của lần đồng bộ catalog domain gần nhất.
Mở lại mailbox cũ đã tồn tại
POST
/ajax.php?f=open_email_address
Mở lại một mailbox cũ theo địa chỉ đầy đủ local@domain để đọc thư trên mailbox đó.

Quan trọng: Endpoint này không tự tạo mailbox mới. Nếu mailbox đã bị xóa trên máy chủ hoặc domain không còn tồn tại trên máy chủ, API trả 404 MAILBOX_NOT_FOUND.

Response trả về dữ liệu session của mailbox đã mở lại, đồng thời kèm catalog domain mới nhất.

Tham số body	Bắt buộc	Mô tả
email_addr	Có	Địa chỉ mailbox cần mở lại, dạng test@tempmailmmo.com.
force_takeover	Không	1/true để takeover nếu mailbox đang bị session khác giữ.
sid_token	Không	Token phiên hiện tại, dùng để ưu tiên resume/takeover đúng ngữ cảnh.
lang	Không	Ngôn ngữ phiên, hỗ trợ vi hoặc en.
{
  "email_addr": "old_mailbox@tempmailmmo.com",
  "email_user": "old_mailbox",
  "email_domain": "tempmailmmo.com",
  "sid_token": "0123456789abcdef0123456789abcdef0123456789abcdef",
  "alias": 0,
  "session_started_at": 1710000000000,
  "session_expires_at": 1710086400000,
  "session_ttl_minutes": 1440,
  "mailbox_event_token": "MAILBOX_EVENT_TOKEN",
  "domains": ["mailmmo.io.vn", "tempmailmmo.com"],
  "defaultDomain": "tempmailmmo.com",
  "domains_updated_at": 1710000000000
}
Schema response	Kiểu	Mô tả
email_addr	string	Địa chỉ mailbox đã mở lại.
email_user	string	Phần local-part của mailbox đã mở lại.
email_domain	string	Domain của mailbox đã mở lại.
sid_token	string (48 hex)	Token phiên dùng cho các action mailbox.
alias	number	Cờ tương thích, hiện trả 0.
session_started_at	number	Unix timestamp (mili giây) thời điểm session được tạo.
session_expires_at	number	Unix timestamp (mili giây) thời điểm session mở lại sẽ hết hạn.
session_ttl_minutes	number	TTL cấu hình của session theo phút.
mailbox_event_token	string	Mailbox event token dùng cho mailbox event stream thời gian thực.
domains	string[]	Danh sách domain khả dụng hiện tại.
defaultDomain	string	Domain mặc định hiện tại của hệ thống.
domains_updated_at	number	Unix timestamp (mili giây) của lần đồng bộ catalog domain gần nhất.
Lỗi thường gặp	HTTP	Mô tả
Mailbox not found on server	404	Mailbox đã bị xóa hoặc không còn tồn tại trên máy chủ.
Email address is already in use by another session	409	Mailbox đang được session khác sử dụng và chưa bật takeover.
Lấy chi tiết email
POST
/ajax.php?f=fetch_email
Trả về toàn bộ nội dung thư theo email_id, gồm body HTML và danh sách tệp đính kèm.

Response header cũng kèm session meta mới nhất. Xem mục Xác thực phiên để lấy các header X-Session-* và X-Mailbox-Event-Token.

Tham số body	Bắt buộc	Mô tả
sid_token	Có	Token phiên đang hoạt động (gửi trong tham số body).
email_id	Có	Mã email lấy từ danh sách list mail_id.
{
  "mail_id": "123",
  "mail_from": "Example Sender <sender@tempmailmmo.com>",
  "mail_subject": "Your OTP",
  "mail_body": "<html>...</html>",
  "mail_timestamp": "1710000000",
  "mail_attachments": [
    {
      "name": "otp.pdf",
      "size": 20480,
      "type": "application/pdf"
    }
  ]
}
Schema response	Kiểu	Mô tả
mail_id	string	ID thư.
mail_from	string	Người gửi.
mail_subject	string	Tiêu đề thư.
mail_body	string (HTML)	Nội dung thư dạng HTML đã xử lý.
mail_timestamp	string	Unix timestamp (giây) dạng chuỗi.
mail_attachments	object[]	Danh sách tệp đính kèm.
Schema item trong mail_attachments[]	Kiểu	Mô tả
name	string	Tên file.
size	number	Kích thước file (bytes).
type	string	MIME type của file.
Tải tệp đính kèm
POST
/ajax.php?f=fetch_attachment
Tải nhị phân tệp đính kèm từ một email cụ thể. API trả trực tiếp nội dung file.

Do response body là binary, metadata session mới nhất được gửi qua response header. Xem mục Xác thực phiên.

Tham số body	Bắt buộc	Mô tả
sid_token	Có	Token phiên đang hoạt động.
email_id	Có	Mã email lấy từ danh sách thư hoặc fetch_email.
file_name	Có	Tên file cần tải, khớp với trường name trong mail_attachments.
curl -X POST "https://your-domain.com/ajax.php?f=fetch_attachment" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "sid_token=YOUR_SID_TOKEN&email_id=123&file_name=otp.pdf" \
  --output otp.pdf
Kết quả response	Giá trị	Mô tả
Body	binary	Nội dung tệp đính kèm.
Content-Type	application/octet-stream	Kiểu nội dung tải về.
Content-Disposition	attachment	Ép trình duyệt tải file.
Xóa email
POST
/ajax.php?f=del_email
Xóa một email hoặc nhiều email theo danh sách id.

Endpoint này cũng gia hạn session và gửi session meta mới nhất qua response header. Xem mục Xác thực phiên.

Tham số body	Bắt buộc	Mô tả
sid_token	Có	Token phiên đang hoạt động (gửi trong tham số body).
email_id hoặc email_ids[]	Không	ID email cần xóa. Nếu bỏ trống, API trả deleted: 0.
{
  "deleted": 1
}
Schema response	Kiểu	Mô tả
deleted	number	Số email đã xóa thành công.
Giới hạn & lưu ý tích hợp
Hạng mục	Giá trị	Ghi chú
HTTP method cho action mailbox	POST	Các action mailbox dùng GET sẽ bị từ chối (405).
sid_token format	48 ký tự hex	Ví dụ: 012345...abcdef.
offset	0 đến 1,000,000	Ngoài khoảng sẽ bị clamp theo server.
Kích thước trang list mail	Tối đa 500 (mặc định 50)	Phụ thuộc cấu hình server.
Số email_id cho del_email	Tối đa 100 ID/request	Server tự giới hạn để tránh lạm dụng.
Kích thước tệp đính kèm tải về	Tối đa 5MB	Vượt giới hạn trả 413.
Rate limit tổng	380 request / phút / IP	Vượt giới hạn trả 429 kèm Retry-After.
Rate limit tạo session	668 lần / phút / IP	Áp dụng cho luồng tạo mailbox/session mới.
Mailbox đang hoạt động	Tối đa 50 session / IP	Khi chạm ngưỡng, hệ thống tự đá batch session cũ của IP đó để nhường chỗ cho session mới.
Thời gian sống của session	1 ngày	Hết hạn không xóa mailbox trên máy chủ, giao diện web sẽ báo hết phiên và tự tạo mailbox/session mới. Mailbox vẫn có thể mở lại hộp thư nếu còn tồn tại.
Mã lỗi thường gặp
400
Thiếu tham số, action không hợp lệ, hoặc format dữ liệu sai.
401
sid_token không hợp lệ hoặc phiên đã hết hạn.
403
Origin không được phép hoặc bị chặn theo policy bảo mật.
404
Email hoặc tệp đính kèm không tồn tại.
405
Gọi sai HTTP method cho action tương ứng.
409
Email đã được session khác sử dụng.
413
Tệp đính kèm quá lớn (vượt giới hạn server).
429
Vượt giới hạn tần suất request, cần retry theo Retry-After.
500
Lỗi xử lý nội bộ server.
502
Dịch vụ upstream tạm thời không khả dụng.
503
Service chưa được cấu hình đầy đủ (ví dụ thiếu domain).
Khuyến nghị: Bọc toàn bộ request bằng timeout 10-15 giây, retry backoff cho lỗi mạng, và tái tạo session khi nhận 401.

Riêng một số lỗi nghiệp vụ có thể kèm mã chi tiết, ví dụ: {"error":"Mailbox not found on server","code":"MAILBOX_NOT_FOUND"}.

Error mẫu theo endpoint
Tất cả lỗi trả về dạng JSON: {"error":"..."}.

# get_email_list - thiếu sid_token
POST /ajax.php?f=get_email_list
=> HTTP 401
{"error":"Missing or invalid sid_token"}

# fetch_email - không tìm thấy email
POST /ajax.php?f=fetch_email
=> HTTP 404
{"error":"Email not found"}

# del_email - sai method
GET /ajax.php?f=del_email
=> HTTP 405
{"error":"Method not allowed. Use POST."}

# fetch_attachment - file quá lớn
POST /ajax.php?f=fetch_attachment
=> HTTP 413
{"error":"Attachment too large"}

# set_email_user - trùng email với session khác
POST /ajax.php?f=set_email_user
=> HTTP 409
{"error":"Email address is already in use by another session"}

# open_email_address - mailbox đã bị xóa trên máy chủ
POST /ajax.php?f=open_email_address
=> HTTP 404
{"error":"Mailbox not found on server","code":"MAILBOX_NOT_FOUND"}

# quá tần suất request
POST /ajax.php?f=get_email_list
=> HTTP 429
{"error":"Too many requests. Please try again later."}
Ví dụ cURL theo luồng
# 1) Tạo session
curl -X POST "https://your-domain.com/ajax.php?f=get_email_address" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "email_domain=mailmmo.io.vn&lang=vi"

# 2) Lấy danh sách thư
curl -X POST "https://your-domain.com/ajax.php?f=get_email_list" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "sid_token=YOUR_SID_TOKEN&offset=0"

# 2b) Mở lại mailbox cũ để đọc thư
curl -X POST "https://your-domain.com/ajax.php?f=open_email_address" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "email_addr=oldbox@mailmmo.io.vn&force_takeover=1&lang=vi"

# 3) Lấy chi tiết một thư
curl -X POST "https://your-domain.com/ajax.php?f=fetch_email" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "sid_token=YOUR_SID_TOKEN&email_id=123"

# 4) Xóa một thư
curl -X POST "https://your-domain.com/ajax.php?f=del_email" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "sid_token=YOUR_SID_TOKEN&email_ids[]=123"