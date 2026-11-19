-- Sao lưu database trước khi chạy. Chạy thủ công bởi chủ dự án.

CREATE TABLE IF NOT EXISTS `guide_topics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_visible` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `guide_topics_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `guides` (
  `id` CHAR(36) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NOT NULL,
  `image` TEXT NULL,
  `topic_id` BIGINT UNSIGNED NULL,
  `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  `read_time` VARCHAR(20) NOT NULL DEFAULT '5 min',
  `published_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `guides_slug_unique` (`slug`),
  KEY `guides_status_published_at_index` (`status`, `published_at`),
  KEY `guides_topic_id_index` (`topic_id`),
  CONSTRAINT `guides_topic_id_foreign`
    FOREIGN KEY (`topic_id`) REFERENCES `guide_topics` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
