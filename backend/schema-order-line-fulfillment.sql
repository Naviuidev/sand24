-- Per line-item shipping / tracking for paid orders (admin fulfilment).
-- mysql -u root -p fashion_db < backend/schema-order-line-fulfillment.sql

CREATE TABLE IF NOT EXISTS order_line_fulfillment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  line_index SMALLINT UNSIGNED NOT NULL COMMENT '0-based index into orders.lines_json',
  tracking_url VARCHAR(512) NULL,
  tracking_id VARCHAR(128) NULL,
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_line (order_id, line_index),
  KEY idx_order_shipped (order_id, shipped_at),
  KEY idx_delivered (delivered_at),
  CONSTRAINT fk_order_line_fulfillment_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
