-- Multiple delivery addresses per customer (checkout). Run after schema-users.sql / schema-users-shipping.sql.
-- mysql -u root -p fashion_db < backend/schema-user-addresses.sql

CREATE TABLE IF NOT EXISTS user_addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  landmark VARCHAR(255) NULL DEFAULT NULL,
  state VARCHAR(128) NOT NULL,
  district VARCHAR(128) NOT NULL,
  city VARCHAR(128) NOT NULL,
  pincode VARCHAR(12) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_addresses_user (user_id),
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: copy existing single shipping address from users into user_addresses (one-time).
-- INSERT INTO user_addresses (user_id, address_line1, landmark, state, district, city, pincode)
-- SELECT id, shipping_address_line1, shipping_landmark, shipping_state, shipping_district, shipping_city, shipping_pincode
-- FROM users
-- WHERE (shipping_address_line1 IS NOT NULL AND TRIM(shipping_address_line1) <> '')
--   AND NOT EXISTS (SELECT 1 FROM user_addresses ua WHERE ua.user_id = users.id);
