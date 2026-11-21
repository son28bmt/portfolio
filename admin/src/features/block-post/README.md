# Block-post editor

## Cấu trúc

- `api/`: gọi API layout template/post.
- `blocks/`: UI chỉnh sửa từng block.
- `components/`: palette, canvas, properties và toolbar.
- `store/`: Zustand state, undo/redo snapshots (`blocks` + `contentByBlockId`).
- `utils/`: geometry và content defaults; media/checkbox helpers dùng shared package.
- `validation/`: validation trước khi gửi API.

## Contract dữ liệu

`layout` là mảng block `{ id, type, x, y, w, h, align, props }`; `content` là object theo block id. Question dùng `props: { templateId, heading? }` và content `{ kind: 'empty' }`. `templateId` phải trỏ tới template dùng chung (`guide_id = null`) đang bật. Layout cũ có content `{ kind: 'question' }` sẽ được normalize thành empty; props cũ bị loại khi lưu. Content checkbox dùng `selections: [{ label, checked }]`. Layout không chứa nội dung người xem trả lời.

## Thêm block mới

1. Thêm type, props và content contract vào admin/server validation.
2. Đăng ký editor component tại `registry/blockRegistry.jsx`.
3. Thêm default content/store handling.
4. Thêm renderer component vào `shared/layout-post-renderer` và test render/server validation.

## Database và shared renderer

Chạy thủ công `server/scripts/sql/create-layout-post-tables.sql` trên database đích; không dùng `sequelize.sync()`. Admin/client import source renderer qua alias `@layout-post-renderer/*`; Vite aliases trỏ đến `../shared/layout-post-renderer`.

## Chạy toàn bộ test

```powershell
Set-Location E:\portfolio; npm.cmd run test:all
```

Runner cũng bundle và chạy `layoutSchema.test.js` (kể cả Question validation) và static renderer test bằng alias shared renderer.

## Giới hạn đã chủ ý

- Checkbox chỉ hiển thị, người xem không tick được; đây là checklist tĩnh.
- Question là chỗ đặt form câu hỏi cuối bài có sẵn (`guide_question_templates`), không thu thập câu trả lời riêng.
- Trang `/bai-viet/:id` là SPA, chưa có meta tag/OG cho chia sẻ mạng xã hội.
- Template câu hỏi chỉ tham chiếu bằng `templateId` trong JSON, không có FK; xóa hoặc tắt template sẽ làm form ở các bài cũ ẩn.

Build xác minh:

```powershell
Set-Location E:\portfolio\admin; npm.cmd run build
Set-Location E:\portfolio\client; npm.cmd run build
```