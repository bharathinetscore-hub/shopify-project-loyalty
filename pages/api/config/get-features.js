import pool from "../../../db/db";

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
    )
  `);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await ensureFeaturesTable();
    const result = await pool.query(
      "SELECT * FROM netst_features_table ORDER BY id ASC LIMIT 1"
    );

    if (!result.rows.length) {
      return res.status(200).json(null);
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("get-features error:", error);
    return res.status(500).json({ message: "Failed to load features configuration" });
  }
}
