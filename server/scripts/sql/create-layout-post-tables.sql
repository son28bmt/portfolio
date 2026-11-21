-- Layout template/post schema for the block post editor.
-- Review and run manually after backing up the database.
-- This file is intentionally not executed by the application or deploy script.
-- The current project does not use Sequelize paranoid models, so deletion is physical.

CREATE TABLE IF NOT EXISTS `layout_templates` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `blocks` JSON NOT NULL,
  `schema_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_by` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_layout_templates_updated_at` (`updated_at`),
  KEY `idx_layout_templates_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `layout_posts` (
  `id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NULL,
  `title` VARCHAR(200) NOT NULL,
  `layout` JSON NOT NULL,
  `content` JSON NOT NULL,
  `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  `published_at` DATETIME NULL,
  `created_by` VARCHAR(191) NULL,
  `publish_target` ENUM('blog', 'guide') NOT NULL DEFAULT 'blog',
  `published_post_id` CHAR(36) NULL,
  `published_post_slug` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_layout_posts_template_id` (`template_id`),
  KEY `idx_layout_posts_status` (`status`),
  KEY `idx_layout_posts_updated_at` (`updated_at`),
  KEY `idx_layout_posts_created_by` (`created_by`),
  CONSTRAINT `layout_posts_template_fk`
    FOREIGN KEY (`template_id`) REFERENCES `layout_templates` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;