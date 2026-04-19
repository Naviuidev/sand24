-- Shipping address columns on `users` (checkout). Run after schema-users.sql.
-- mysql -u root -p fashion_db < backend/schema-users-shipping.sql

ALTER TABLE users
  ADD COLUMN shipping_address_line1 VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Address line 1',
  ADD COLUMN shipping_address_line2 VARCHAR(255) NULL DEFAULT NULL COMMENT 'Address line 2 (optional)',
  ADD COLUMN shipping_landmark VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN shipping_state VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN shipping_district VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN shipping_city VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN shipping_pincode VARCHAR(12) NULL DEFAULT NULL;
