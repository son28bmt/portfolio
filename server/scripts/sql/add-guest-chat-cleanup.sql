-- Chỉ chạy nếu AUTO_SCHEMA_BOOTSTRAP đang tắt; sao lưu database và chạy đúng một lần.
ALTER TABLE `LiveChatMessages`
  ADD COLUMN `guestCleanupAt` DATETIME NULL AFTER `replyContext`;