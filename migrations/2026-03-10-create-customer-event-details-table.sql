BEGIN;

CREATE TABLE IF NOT EXISTS netst_customer__event_details_table (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  date_created DATE DEFAULT NULL,
  event_name VARCHAR(255) DEFAULT NULL,
  points_earned NUMERIC(10,2) DEFAULT 0.00,
  points_redeemed NUMERIC(10,2) DEFAULT 0.00,
  points_left NUMERIC(10,2) DEFAULT 0.00,
  transaction_id BIGINT DEFAULT NULL,
  amount NUMERIC(10,2) DEFAULT 0.00,
  gift_code VARCHAR(100) DEFAULT NULL,
  receiver_email VARCHAR(255) DEFAULT NULL,
  refer_friend_id BIGINT DEFAULT NULL,
  comments TEXT DEFAULT NULL,
  points_expiration_date DATE DEFAULT NULL,
  points_expiration_days VARCHAR(255) DEFAULT NULL,
  expired BOOLEAN DEFAULT FALSE,
  points_type VARCHAR(10) DEFAULT 'positive',
  created_at TIMESTAMP DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT NULL,
  event_id INTEGER DEFAULT NULL,
  CONSTRAINT chk_netst_customer_event_points_type
    CHECK (points_type IN ('positive', 'negative'))
);

CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_customer_id
  ON netst_customer__event_details_table (customer_id);

CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_event_name
  ON netst_customer__event_details_table (event_name);

CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_transaction_id
  ON netst_customer__event_details_table (transaction_id);

CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_refer_friend_id
  ON netst_customer__event_details_table (refer_friend_id);

CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_event_id
  ON netst_customer__event_details_table (event_id);

COMMIT;

