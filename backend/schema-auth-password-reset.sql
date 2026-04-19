-- Run once if auth_otps already exists without password_reset:
-- mysql -u root -p fashion_db < backend/schema-auth-password-reset.sql

ALTER TABLE auth_otps
  MODIFY COLUMN purpose ENUM('login', 'register', 'password_reset') NOT NULL;
