const pool = require("../db/db");

async function createProductItemTable() {
  try {
    console.log("Connecting to DB...");

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

    console.log("netst_product_item table created successfully");

    process.exit();

  } catch (err) {
    console.error("Product Item Migration Failed:", err);
    process.exit(1);
  }
}

createProductItemTable();