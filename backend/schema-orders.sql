-- Orders + PhonePe payment state. Address JSON is stored only with the order until payment succeeds;
-- shipping fields on `users` / `user_addresses` should be updated in application code after PAID.
-- mysql -u root -p fashion_db < backend/schema-orders.sql

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  merchant_order_id VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  amount_inr DECIMAL(12,2) NOT NULL COMMENT 'Order total in INR (rupees); PhonePe still uses paise in API calls',
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status ENUM('PENDING_PAYMENT', 'PAID', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING_PAYMENT',
  lines_json JSON NOT NULL,
  address_json JSON NOT NULL,
  customer_json JSON NULL COMMENT 'firstName, lastName, email snapshot',
  phonepe_state VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_merchant (merchant_order_id),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
