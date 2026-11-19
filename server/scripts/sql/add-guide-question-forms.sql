-- Sao lưu database trước khi chạy. Chỉ chạy thủ công, không dùng sync/migrate.
-- MySQL 8.0 và MariaDB 10.11 hỗ trợ ADD COLUMN IF NOT EXISTS.
DELIMITER //
CREATE PROCEDURE `upgrade_guide_question_message_content`()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'LiveChatMessages'
      AND column_name = 'content'
      AND data_type <> 'longtext'
  ) THEN
    ALTER TABLE `LiveChatMessages` MODIFY COLUMN `content` LONGTEXT NOT NULL;
  END IF;
END//
DELIMITER ;

CALL `upgrade_guide_question_message_content`();
DROP PROCEDURE `upgrade_guide_question_message_content`;

ALTER TABLE `LiveChatMessages`
  ADD COLUMN IF NOT EXISTS `messageType` ENUM('text', 'guide_question') NULL AFTER `content`,
  ADD COLUMN IF NOT EXISTS `guideContext` JSON NULL AFTER `messageType`,
  ADD COLUMN IF NOT EXISTS `questionSnapshot` JSON NULL AFTER `guideContext`;

CREATE TABLE IF NOT EXISTS `guide_question_templates` (
  `id` CHAR(36) NOT NULL,
  `guide_id` CHAR(36) NULL,
  `name` VARCHAR(160) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `fields` JSON NOT NULL,
  `created_by` VARCHAR(191) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guide_question_templates_guide_active` (`guide_id`, `is_active`),
  CONSTRAINT `guide_question_templates_guide_fk`
    FOREIGN KEY (`guide_id`) REFERENCES `guides` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;