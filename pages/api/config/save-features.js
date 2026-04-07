import pool from "../../../db/db";

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const next = String(value).trim();
  return next === "" ? null : next;
}

function cleanBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
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
    )
  `);

  await pool.query(`
    ALTER TABLE netst_features_table
    ADD COLUMN IF NOT EXISTS loyalty_points_earned_label TEXT
  `);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await ensureFeaturesTable();

    const existing = await pool.query(
      "SELECT * FROM netst_features_table ORDER BY id ASC LIMIT 1"
    );
    const current = existing.rows[0] || {};

    const finalData = {
      loyalty_eligible: cleanBool(req.body?.loyaltyEligible, current.loyalty_eligible ?? false),
      product_sharing_through_email: cleanBool(
        req.body?.productSharingThroughEmail,
        current.product_sharing_through_email ?? false
      ),
      enable_referral_code_use_at_signup: cleanBool(
        req.body?.enableReferralCodeUseAtSignup,
        current.enable_referral_code_use_at_signup ?? false
      ),
      login_to_see_points: cleanBool(req.body?.loginToSeePoints, current.login_to_see_points ?? false),
      enable_redeem_history: cleanBool(req.body?.enableRedeemHistory, current.enable_redeem_history ?? false),
      enable_refer_friend: cleanBool(req.body?.enableReferFriend, current.enable_refer_friend ?? false),
      enable_gift_certificate_generation: cleanBool(
        req.body?.enableGiftCertificateGeneration,
        current.enable_gift_certificate_generation ?? false
      ),
      enable_tiers_info: cleanBool(req.body?.enableTiersInfo, current.enable_tiers_info ?? false),
      enable_profile_info: cleanBool(req.body?.enableProfileInfo, current.enable_profile_info ?? false),
      enable_points_redeem_on_checkout: cleanBool(
        req.body?.enablePointsRedeemOnCheckout,
        current.enable_points_redeem_on_checkout ?? false
      ),
      my_account_tab_heading: cleanText(req.body?.myAccountTabHeading ?? current.my_account_tab_heading),
      loyalty_points_earned_label: cleanText(
        req.body?.loyaltyPointsEarnedLabel ?? current.loyalty_points_earned_label
      ),
      redeem_history_label: cleanText(req.body?.redeemHistoryLabel ?? current.redeem_history_label),
      refer_friend_label: cleanText(req.body?.referFriendLabel ?? current.refer_friend_label),
      gift_card_label: cleanText(req.body?.giftCardLabel ?? current.gift_card_label),
      tiers_label: cleanText(req.body?.tiersLabel ?? current.tiers_label),
      update_profile_label: cleanText(req.body?.updateProfileLabel ?? current.update_profile_label),
      product_redeem_label: cleanText(req.body?.productRedeemLabel ?? current.product_redeem_label),
    };

    if (!existing.rows.length) {
      await pool.query(
        `
          INSERT INTO netst_features_table (
            loyalty_eligible,
            product_sharing_through_email,
            enable_referral_code_use_at_signup,
            login_to_see_points,
            enable_redeem_history,
            enable_refer_friend,
            enable_gift_certificate_generation,
            enable_tiers_info,
            enable_profile_info,
            enable_points_redeem_on_checkout,
            my_account_tab_heading,
            loyalty_points_earned_label,
            redeem_history_label,
            refer_friend_label,
            gift_card_label,
            tiers_label,
            update_profile_label,
            product_redeem_label,
            created_at,
            updated_at
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,
            NOW(),NOW()
          )
        `,
        [
          finalData.loyalty_eligible,
          finalData.product_sharing_through_email,
          finalData.enable_referral_code_use_at_signup,
          finalData.login_to_see_points,
          finalData.enable_redeem_history,
          finalData.enable_refer_friend,
          finalData.enable_gift_certificate_generation,
          finalData.enable_tiers_info,
          finalData.enable_profile_info,
          finalData.enable_points_redeem_on_checkout,
          finalData.my_account_tab_heading,
          finalData.loyalty_points_earned_label,
          finalData.redeem_history_label,
          finalData.refer_friend_label,
          finalData.gift_card_label,
          finalData.tiers_label,
          finalData.update_profile_label,
          finalData.product_redeem_label,
        ]
      );
    } else {
      await pool.query(
        `
          UPDATE netst_features_table
          SET
            loyalty_eligible = $1,
            product_sharing_through_email = $2,
            enable_referral_code_use_at_signup = $3,
            login_to_see_points = $4,
            enable_redeem_history = $5,
            enable_refer_friend = $6,
            enable_gift_certificate_generation = $7,
            enable_tiers_info = $8,
            enable_profile_info = $9,
            enable_points_redeem_on_checkout = $10,
            my_account_tab_heading = $11,
            loyalty_points_earned_label = $12,
            redeem_history_label = $13,
            refer_friend_label = $14,
            gift_card_label = $15,
            tiers_label = $16,
            update_profile_label = $17,
            product_redeem_label = $18,
            updated_at = NOW()
          WHERE id = $19
        `,
        [
          finalData.loyalty_eligible,
          finalData.product_sharing_through_email,
          finalData.enable_referral_code_use_at_signup,
          finalData.login_to_see_points,
          finalData.enable_redeem_history,
          finalData.enable_refer_friend,
          finalData.enable_gift_certificate_generation,
          finalData.enable_tiers_info,
          finalData.enable_profile_info,
          finalData.enable_points_redeem_on_checkout,
          finalData.my_account_tab_heading,
          finalData.loyalty_points_earned_label,
          finalData.redeem_history_label,
          finalData.refer_friend_label,
          finalData.gift_card_label,
          finalData.tiers_label,
          finalData.update_profile_label,
          finalData.product_redeem_label,
          current.id,
        ]
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("save-features error:", error);
    return res.status(500).json({ success: false, message: "Failed to save features configuration" });
  }
}
