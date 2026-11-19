-- Sao lưu database trước khi chạy. File này chỉ để chủ dự án chạy thủ công.
-- Không chạy bằng sequelize.sync/migrate.

ALTER TABLE `admins`
  ADD COLUMN `role` ENUM('owner', 'editor', 'support') NOT NULL DEFAULT 'owner' AFTER `password`;

ALTER TABLE `users`
  ADD COLUMN `role` ENUM('owner', 'editor', 'support') NULL DEFAULT NULL AFTER `password`;

-- Chuyển tiếp an toàn: các tài khoản marketplace admin hiện có giữ quyền Owner
-- nhờ DEFAULT 'owner'. Gán các username cũ trong ADMIN_USERNAMES thành Owner:
-- UPDATE `users` SET `role` = 'owner'
-- WHERE LOWER(`username`) IN ('admin' /*, 'ten-admin-khac' */);
--
-- Sau khi kiểm tra backup và đăng nhập: hạ quyền từng tài khoản khi cần:
-- UPDATE `admins` SET `role` = 'editor' WHERE `username` = '...';
-- UPDATE `admins` SET `role` = 'support' WHERE `username` = '...';
-- UPDATE `users` SET `role` = 'editor' WHERE `username` = '...';
-- UPDATE `users` SET `role` = 'support' WHERE `username` = '...';