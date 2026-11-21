-- Store Gridbox layouts alongside the selected Blog or Guide record.
-- Run after create-layout-post-tables.sql on an existing database.
ALTER TABLE `layout_posts`
  ADD COLUMN `publish_target` ENUM('blog', 'guide') NOT NULL DEFAULT 'blog',
  ADD COLUMN `published_post_id` CHAR(36) NULL,
  ADD COLUMN `published_post_slug` VARCHAR(191) NULL;

ALTER TABLE `Blogs`
  ADD COLUMN `layout` JSON NULL,
  ADD COLUMN `content_json` JSON NULL,
  ADD COLUMN `layout_post_id` CHAR(36) NULL;

ALTER TABLE `guides`
  ADD COLUMN `layout` JSON NULL,
  ADD COLUMN `content_json` JSON NULL,
  ADD COLUMN `layout_post_id` CHAR(36) NULL;