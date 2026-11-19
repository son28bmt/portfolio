-- Sao lưu database trước khi chạy. Chỉ chạy thủ công, không dùng sync/migrate.
-- LiveChatMessage không đặt tableName/underscored nên Sequelize mặc định dùng
-- bảng LiveChatMessages và các cột guestId, isRead, createdAt...
ALTER TABLE `LiveChatMessages`
  ADD COLUMN `userId` CHAR(36) NULL AFTER `guestId`,
  ADD COLUMN `purchaseStatus` ENUM('unknown', 'purchased', 'not_purchased') NULL AFTER `isRead`,
  ADD COLUMN `assignedBy` VARCHAR(191) NULL AFTER `purchaseStatus`,
  ADD COLUMN `assignedAt` DATETIME NULL AFTER `assignedBy`,
  ADD COLUMN `assignmentNotes` TEXT NULL AFTER `assignedAt`,
  ADD COLUMN `packageType` VARCHAR(120) NULL AFTER `assignmentNotes`,
  ADD COLUMN `printerModel` VARCHAR(160) NULL AFTER `packageType`,
  ADD KEY `idx_live_chat_messages_user_id` (`userId`);