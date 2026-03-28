BEGIN;

ALTER TABLE netst_loyalty_config_table
  ALTER COLUMN customer_signup_points TYPE NUMERIC(10,2) USING customer_signup_points::NUMERIC(10,2),
  ALTER COLUMN product_review_points TYPE NUMERIC(10,2) USING product_review_points::NUMERIC(10,2),
  ALTER COLUMN referral_points TYPE NUMERIC(10,2) USING referral_points::NUMERIC(10,2),
  ALTER COLUMN birthday_points TYPE NUMERIC(10,2) USING birthday_points::NUMERIC(10,2),
  ALTER COLUMN anniversary_points TYPE NUMERIC(10,2) USING anniversary_points::NUMERIC(10,2),
  ALTER COLUMN minimum_redemption_points TYPE NUMERIC(10,2) USING minimum_redemption_points::NUMERIC(10,2),
  ALTER COLUMN email_share_points TYPE NUMERIC(10,2) USING email_share_points::NUMERIC(10,2),
  ALTER COLUMN facebook_share_points TYPE NUMERIC(10,2) USING facebook_share_points::NUMERIC(10,2);

COMMIT;
