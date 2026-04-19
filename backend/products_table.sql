-- Run in phpMyAdmin (same database as `categories`). Fixes 500 on POST /api/products if the table is missing.

CREATE TABLE IF NOT EXISTS `products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `original_price` DECIMAL(10,2) NOT NULL,
  `offer_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `final_price` DECIMAL(10,2) NOT NULL,
  `sizes_json` JSON NOT NULL,
  `quantity_available` INT UNSIGNED NOT NULL DEFAULT 0,
  `fabric` VARCHAR(255) NOT NULL DEFAULT '',
  `color` VARCHAR(255) NOT NULL DEFAULT '',
  `print_style` VARCHAR(255) NOT NULL DEFAULT '',
  `body_fit` VARCHAR(255) NOT NULL DEFAULT '',
  `features` TEXT,
  `neck_type` VARCHAR(255) NOT NULL DEFAULT '',
  `product_details` TEXT,
  `shipment_delivery` TEXT,
  `return_exchange` TEXT,
  `image_1_mime` VARCHAR(127) DEFAULT NULL,
  `image_1_data` LONGBLOB DEFAULT NULL,
  `image_2_mime` VARCHAR(127) DEFAULT NULL,
  `image_2_data` LONGBLOB DEFAULT NULL,
  `image_3_mime` VARCHAR(127) DEFAULT NULL,
  `image_3_data` LONGBLOB DEFAULT NULL,
  `image_4_mime` VARCHAR(127) DEFAULT NULL,
  `image_4_data` LONGBLOB DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_category` (`category_id`),
  CONSTRAINT `fk_products_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
