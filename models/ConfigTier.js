const pool = require("../db/db");

async function createTables() {
  try {
    console.log("Connecting to DB...");

    // CONFIG TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
        id SERIAL PRIMARY KEY,

        customer_signup_points NUMERIC(10,2),
        product_review_points NUMERIC(10,2),
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

    console.log("Config table created");

    // TIERS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS netst_loyalty_tiers_table (
        id SERIAL PRIMARY KEY,

        tier_name VARCHAR(100),

        threshold DECIMAL(10,2),

        ns_id VARCHAR(100),

        description TEXT,

        level INTEGER,

        status BOOLEAN,

        created_at TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    console.log("Tiers table created");

    process.exit();

  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

createTables();
