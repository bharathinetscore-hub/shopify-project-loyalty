const fs = require("fs");
const path = require("path");
const pool = require("../db/db");

async function ensureTokenTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_shopify_tokens (
      id BIGSERIAL PRIMARY KEY,
      shop_domain TEXT NOT NULL UNIQUE,
      access_token TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureConfigAndTiersTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
      id SERIAL PRIMARY KEY,
      customer_signup_points NUMERIC(10,2),
      referral_points NUMERIC(10,2),
      birthday_points NUMERIC(10,2),
      anniversary_points NUMERIC(10,2),
      each_point_value DECIMAL(10,2),
      giftcard_expiry_days VARCHAR(255),
      loyalty_point_value DECIMAL(10,2),
      points_expiration_days VARCHAR(255),
      netsuite_endpoint_url VARCHAR(500),
      minimum_redemption_points NUMERIC(10,2),
      email_share_points NUMERIC(10,2),
      facebook_share_points NUMERIC(10,2),
      newsletter_subscription BOOLEAN,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_tiers_table (
      id SERIAL PRIMARY KEY,
      tier_name VARCHAR(100),
      threshold DECIMAL(10,2),
      ns_id VARCHAR(100),
      description TEXT,
      level INTEGER,
      status BOOLEAN,
      points_per_dollar NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS points_per_dollar NUMERIC(10,2) DEFAULT 0;
  `);
}

async function ensureProductTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_product_item (
      id SERIAL PRIMARY KEY,
      item_id BIGINT NOT NULL UNIQUE,
      user_id BIGINT,
      customer_id BIGINT,
      is_eligible_for_loyalty_program BOOLEAN DEFAULT FALSE,
      enable_collection_type BOOLEAN DEFAULT FALSE,
      collection_type VARCHAR(32) DEFAULT 'points',
      points_based_points DECIMAL(10,2) DEFAULT 0.00,
      sku_based_points DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureFeaturesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_features_table (
      id SERIAL PRIMARY KEY,
      loyalty_eligible BOOLEAN DEFAULT FALSE,
      product_sharing_through_email BOOLEAN DEFAULT FALSE,
      enable_referral_code_use_at_signup BOOLEAN DEFAULT FALSE,
      login_to_see_points BOOLEAN DEFAULT FALSE,
      enable_redeem_history BOOLEAN DEFAULT FALSE,
      enable_refer_friend BOOLEAN DEFAULT FALSE,
      enable_gift_certificate_generation BOOLEAN DEFAULT FALSE,
      enable_tiers_info BOOLEAN DEFAULT FALSE,
      enable_profile_info BOOLEAN DEFAULT FALSE,
      enable_points_redeem_on_checkout BOOLEAN DEFAULT FALSE,
      my_account_tab_heading TEXT,
      loyalty_points_earned_label TEXT,
      redeem_history_label TEXT,
      refer_friend_label TEXT,
      gift_card_label TEXT,
      tiers_label TEXT,
      update_profile_label TEXT,
      product_redeem_label TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE netst_features_table
    ADD COLUMN IF NOT EXISTS loyalty_points_earned_label TEXT;
  `);
}

async function ensureEmailTemplatesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_email_template (
      id SERIAL PRIMARY KEY,
      template_key VARCHAR(100) NOT NULL UNIQUE,
      template_name VARCHAR(255) DEFAULT NULL,
      subject TEXT DEFAULT NULL,
      text_body TEXT DEFAULT NULL,
      html_body TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customers_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NULL,
      customer_birthday DATE NULL,
      customer_anniversary DATE NULL,
      customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT FALSE,
      customer_referral_code TEXT NULL,
      customer_used_referral_code TEXT NULL,
      total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0,
      available_points NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_birthday DATE NULL;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_anniversary DATE NULL;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_referral_code TEXT NULL;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_used_referral_code TEXT NULL;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);
  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS available_points NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);
}

async function ensureEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE netst_events_table
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
}

async function ensureCustomerEventDetailsTable() {
  await pool.query(`
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_customer_id
    ON netst_customer__event_details_table (customer_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_event_name
    ON netst_customer__event_details_table (event_name);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_transaction_id
    ON netst_customer__event_details_table (transaction_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_refer_friend_id
    ON netst_customer__event_details_table (refer_friend_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_event_id
    ON netst_customer__event_details_table (event_id);
  `);
}

async function runSqlMigrations() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.toLowerCase().endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8").trim();
    if (!sql) continue;
    await pool.query(sql);
  }
}

let bootstrapPromise = null;

async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureTokenTable();
      await ensureConfigAndTiersTables();
      await ensureProductTable();
      await ensureFeaturesTable();
      await ensureEmailTemplatesTable();
      await ensureCustomersTable();
      await ensureEventsTable();
      await ensureCustomerEventDetailsTable();
      await runSqlMigrations();
      console.log("Database bootstrap complete");
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

module.exports = {
  bootstrapDatabase,
};
