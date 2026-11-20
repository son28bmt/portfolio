-- Repair missing chat columns on an existing MySQL database; safe to run repeatedly.
DROP PROCEDURE IF EXISTS `repair_live_chat_columns`;
DELIMITER //
CREATE PROCEDURE `repair_live_chat_columns`()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'userId'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `userId` CHAR(36) NULL AFTER `guestId`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'purchaseStatus'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `purchaseStatus` ENUM('unknown', 'purchased', 'not_purchased') NULL AFTER `isRead`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'assignedBy'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `assignedBy` VARCHAR(191) NULL AFTER `purchaseStatus`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'assignedAt'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `assignedAt` DATETIME NULL AFTER `assignedBy`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'assignmentNotes'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `assignmentNotes` TEXT NULL AFTER `assignedAt`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'packageType'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `packageType` VARCHAR(120) NULL AFTER `assignmentNotes`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'printerModel'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `printerModel` VARCHAR(160) NULL AFTER `packageType`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'messageType'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `messageType` ENUM('text', 'guide_question') NULL AFTER `content`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'guideContext'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `guideContext` JSON NULL AFTER `messageType`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'questionSnapshot'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `questionSnapshot` JSON NULL AFTER `guideContext`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'replyContext'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `replyContext` JSON NULL AFTER `questionSnapshot`;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'guestCleanupAt'
  ) THEN
    ALTER TABLE `LiveChatMessages` ADD COLUMN `guestCleanupAt` DATETIME NULL AFTER `replyContext`;
  END IF;
END//
DELIMITER ;

CALL `repair_live_chat_columns`();
DROP PROCEDURE `repair_live_chat_columns`;