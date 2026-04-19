-- One-time: replace amount_paise (minor units) with amount_inr (rupees) for readable DB values.
-- Run: mysql -u root -p fashion_db < backend/schema-orders-migrate-amount-inr.sql
-- (Skip if you created `orders` fresh from schema-orders.sql after amount_inr was added.)

ALTER TABLE orders ADD COLUMN amount_inr DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER user_id;

UPDATE orders SET amount_inr = ROUND(amount_paise / 100, 2);

ALTER TABLE orders DROP COLUMN amount_paise;
