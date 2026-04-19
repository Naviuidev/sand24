-- Add ban flag for customer accounts (run once against your app database).
-- mysql -u root -p fashion_db < backend/schema-users-ban.sql

ALTER TABLE users
  ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0
  AFTER email_verified;
