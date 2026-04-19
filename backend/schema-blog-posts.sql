-- Sand 24 Journal / blog posts (run in phpMyAdmin against your app database)
-- InnoDB + utf8mb4 for emoji and long slugs.

CREATE TABLE IF NOT EXISTS blog_posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(190) NOT NULL,
  title VARCHAR(500) NOT NULL,
  banner_headline VARCHAR(500) NULL,
  banner_subtitle TEXT NULL,
  button_label VARCHAR(200) NULL,
  button_href VARCHAR(600) NULL,
  listing_summary TEXT NULL,
  cover_image_mime VARCHAR(128) NULL,
  cover_image_data LONGBLOB NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = visible on public /journal',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blog_posts_slug (slug),
  KEY idx_blog_posts_created (created_at),
  KEY idx_blog_posts_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_blocks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  blog_id INT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  block_type ENUM('heading', 'paragraph', 'heading_paragraph', 'image') NOT NULL,
  col_span TINYINT UNSIGNED NOT NULL DEFAULT 12,
  heading TEXT NULL,
  paragraph TEXT NULL,
  image_mime VARCHAR(128) NULL,
  image_data LONGBLOB NULL,
  KEY idx_blog_blocks_blog (blog_id, sort_order),
  CONSTRAINT fk_blog_blocks_post FOREIGN KEY (blog_id) REFERENCES blog_posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
