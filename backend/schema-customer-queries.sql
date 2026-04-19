-- Customer support queries (profile "Raised queries" + admin handling).
-- Run in phpMyAdmin: SQL tab → paste → Go. Or: mysql -u root -p fashion_db < backend/schema-customer-queries.sql

CREATE TABLE IF NOT EXISTS customer_queries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  category VARCHAR(64) NOT NULL COMMENT 'purchase_problem | payment_deducted_no_order | bulk_order_request | custom',
  message TEXT NOT NULL,
  admin_note TEXT NULL,
  contacted ENUM('not_contacted', 'contacted') NOT NULL DEFAULT 'not_contacted',
  status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_queries_user (user_id),
  KEY idx_customer_queries_status (status),
  CONSTRAINT fk_customer_queries_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
