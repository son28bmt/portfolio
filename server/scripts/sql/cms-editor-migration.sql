-- CMS editor schema migration. Run manually on staging/production after a backup.
-- MySQL 5.7+/8.0 compatible. It is idempotent: each column/index is checked first.
-- Do not run this through sequelize.sync(). AUTO_SCHEMA_BOOTSTRAP defaults to false.

-- Pre-flight checks
SELECT DATABASE() AS current_database;
SHOW TABLES LIKE 'Blogs';
SHOW TABLES LIKE 'guides';
SHOW COLUMNS FROM `Blogs`;
SHOW COLUMNS FROM `guides`;

DELIMITER $$
DROP PROCEDURE IF EXISTS `cms_add_column_if_missing`$$
CREATE PROCEDURE `cms_add_column_if_missing`(IN table_name VARCHAR(64), IN column_name VARCHAR(64), IN definition_sql TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = table_name AND COLUMN_NAME = column_name
  ) THEN
    SET @cms_sql = CONCAT('ALTER TABLE `', table_name, '` ADD COLUMN `', column_name, '` ', definition_sql);
    PREPARE cms_stmt FROM @cms_sql; EXECUTE cms_stmt; DEALLOCATE PREPARE cms_stmt;
  END IF;
END$$
DROP PROCEDURE IF EXISTS `cms_add_index_if_missing`$$
CREATE PROCEDURE `cms_add_index_if_missing`(IN table_name VARCHAR(64), IN index_name VARCHAR(64), IN fields_sql TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = table_name AND INDEX_NAME = index_name
  ) THEN
    SET @cms_sql = CONCAT('ALTER TABLE `', table_name, '` ADD INDEX `', index_name, '` ', fields_sql);
    PREPARE cms_stmt FROM @cms_sql; EXECUTE cms_stmt; DEALLOCATE PREPARE cms_stmt;
  END IF;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS `post_revisions` (
  `id` CHAR(36) NOT NULL,
  `post_type` ENUM('blog','guide') NOT NULL,
  `post_id` CHAR(36) NOT NULL,
  `action` ENUM('created','updated','published','scheduled','archived','restored','autosaved') NOT NULL DEFAULT 'updated',
  `snapshot` JSON NOT NULL,
  `author_id` VARCHAR(191) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL cms_add_column_if_missing('Blogs', 'status', "ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'published'");
CALL cms_add_column_if_missing('Blogs', 'published_at', 'DATETIME NULL');
CALL cms_add_column_if_missing('Blogs', 'scheduled_at', 'DATETIME NULL');
CALL cms_add_column_if_missing('Blogs', 'author_id', 'VARCHAR(191) NULL');
CALL cms_add_column_if_missing('Blogs', 'seo_title', 'VARCHAR(255) NULL');
CALL cms_add_column_if_missing('Blogs', 'seo_description', 'VARCHAR(500) NULL');
CALL cms_add_column_if_missing('Blogs', 'og_image', 'LONGTEXT NULL');
CALL cms_add_column_if_missing('Blogs', 'canonical_url', 'TEXT NULL');
CALL cms_add_column_if_missing('Blogs', 'cover_alt', 'VARCHAR(255) NULL');
CALL cms_add_column_if_missing('Blogs', 'cover_caption', 'VARCHAR(500) NULL');
CALL cms_add_column_if_missing('Blogs', 'cms_version', 'INT UNSIGNED NOT NULL DEFAULT 0');

CALL cms_add_column_if_missing('guides', 'tags', 'JSON NULL');
CALL cms_add_column_if_missing('guides', 'scheduled_at', 'DATETIME NULL');
CALL cms_add_column_if_missing('guides', 'author_id', 'VARCHAR(191) NULL');
CALL cms_add_column_if_missing('guides', 'seo_title', 'VARCHAR(255) NULL');
CALL cms_add_column_if_missing('guides', 'seo_description', 'VARCHAR(500) NULL');
CALL cms_add_column_if_missing('guides', 'og_image', 'LONGTEXT NULL');
CALL cms_add_column_if_missing('guides', 'canonical_url', 'TEXT NULL');
CALL cms_add_column_if_missing('guides', 'cover_alt', 'VARCHAR(255) NULL');
CALL cms_add_column_if_missing('guides', 'cover_caption', 'VARCHAR(500) NULL');
CALL cms_add_column_if_missing('guides', 'cms_version', 'INT UNSIGNED NOT NULL DEFAULT 0');

ALTER TABLE `Blogs` MODIFY COLUMN `status` ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'published';
ALTER TABLE `guides` MODIFY COLUMN `status` ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft';
CALL cms_add_index_if_missing('Blogs', 'idx_blogs_status_scheduled_at', '(`status`, `scheduled_at`)');
CALL cms_add_index_if_missing('Blogs', 'idx_blogs_status_published_at', '(`status`, `published_at`)');
CALL cms_add_index_if_missing('guides', 'idx_guides_status_scheduled_at', '(`status`, `scheduled_at`)');
CALL cms_add_index_if_missing('guides', 'idx_guides_status_published_at', '(`status`, `published_at`)');
CALL cms_add_index_if_missing('post_revisions', 'idx_post_revisions_post', '(`post_type`, `post_id`, `created_at`)');

DROP PROCEDURE IF EXISTS `cms_add_column_if_missing`;
DROP PROCEDURE IF EXISTS `cms_add_index_if_missing`;

-- Post-flight checks
SHOW COLUMNS FROM `Blogs` LIKE 'status';
SHOW COLUMNS FROM `guides` LIKE 'scheduled_at';
SHOW INDEX FROM `Blogs` WHERE Key_name IN ('idx_blogs_status_scheduled_at', 'idx_blogs_status_published_at');
SHOW INDEX FROM `guides` WHERE Key_name IN ('idx_guides_status_scheduled_at', 'idx_guides_status_published_at');
SHOW INDEX FROM `post_revisions` WHERE Key_name = 'idx_post_revisions_post';

-- Google member sign-in (run this section together with the CMS migration).
DELIMITER $$
DROP PROCEDURE IF EXISTS `member_add_google_sub_if_missing`$$
CREATE PROCEDURE `member_add_google_sub_if_missing`()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'google_sub') THEN
    ALTER TABLE `user_profiles` ADD COLUMN `google_sub` VARCHAR(255) NULL;
  END IF;
END$$
DELIMITER ;
CALL `member_add_google_sub_if_missing`();
DROP PROCEDURE IF EXISTS `member_add_google_sub_if_missing`;
DELIMITER $$
DROP PROCEDURE IF EXISTS `member_add_google_sub_index_if_missing`$$
CREATE PROCEDURE `member_add_google_sub_index_if_missing`()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'google_sub')
     AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_profiles' AND INDEX_NAME = 'user_profiles_google_sub_unique') THEN
    ALTER TABLE `user_profiles` ADD UNIQUE KEY `user_profiles_google_sub_unique` (`google_sub`);
  END IF;
END$$
DELIMITER ;
CALL `member_add_google_sub_index_if_missing`();
DROP PROCEDURE IF EXISTS `member_add_google_sub_index_if_missing`;