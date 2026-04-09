const pool = require("../db/db");

// ================= CONFIG SAVE =================
async function saveConfig(data) {

  // Helper: convert "" → null
  const clean = (v) => (v === "" || v === undefined ? null : v);

  // Get existing row
  const existing = await pool.query(
    "SELECT * FROM netst_loyalty_config_table LIMIT 1"
  );

  let current = {};

  if (existing.rows.length > 0) {
    current = existing.rows[0];
  }

  // Merge + clean
  const finalData = {

    signup: clean(data.signup ?? current.customer_signup_points),
    referral: clean(data.referral ?? current.referral_points),
    birthday: clean(data.birthday ?? current.birthday_points),
    anniversary: clean(data.anniversary ?? current.anniversary_points),

    pointValue: clean(data.pointValue ?? current.each_point_value),
    equivalent: clean(data.equivalent ?? current.loyalty_point_value),

    pointsExpiry: clean(data.pointsExpiry ?? current.points_expiration_days),
    giftcardExpiry: clean(data.giftcardExpiry ?? current.giftcard_expiry_days),

    netsuiteEndpoint:
      clean(data.netsuiteEndpoint ?? current.netsuite_endpoint_url),

    threshold:
      clean(data.threshold ?? current.minimum_redemption_points),

    email: clean(data.email ?? current.email_share_points),
    facebook: clean(data.facebook ?? current.facebook_share_points),
  };


  // INSERT if no row
  if (existing.rows.length === 0) {

    await pool.query(
      `
      INSERT INTO netst_loyalty_config_table (

        customer_signup_points,
        referral_points,
        birthday_points,
        anniversary_points,

        each_point_value,
        loyalty_point_value,

        points_expiration_days,
        giftcard_expiry_days,

        netsuite_endpoint_url,

        minimum_redemption_points,

        email_share_points,
        facebook_share_points,

        created_at,
        updated_at

      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
      `,
      [
        finalData.signup,
        finalData.referral,
        finalData.birthday,
        finalData.anniversary,

        finalData.pointValue,
        finalData.equivalent,

        finalData.pointsExpiry,
        finalData.giftcardExpiry,

        finalData.netsuiteEndpoint,

        finalData.threshold,

        finalData.email,
        finalData.facebook,
      ]
    );

  } else {

    // UPDATE if exists
    await pool.query(
      `
      UPDATE netst_loyalty_config_table
      SET

        customer_signup_points = $1,
        referral_points = $2,
        birthday_points = $3,
        anniversary_points = $4,

        each_point_value = $5,
        loyalty_point_value = $6,

        points_expiration_days = $7,
        giftcard_expiry_days = $8,

        netsuite_endpoint_url = $9,

        minimum_redemption_points = $10,

        email_share_points = $11,
        facebook_share_points = $12,

        updated_at = NOW()

      WHERE id = $13
      `,
      [
        finalData.signup,
        finalData.referral,
        finalData.birthday,
        finalData.anniversary,

        finalData.pointValue,
        finalData.equivalent,

        finalData.pointsExpiry,
        finalData.giftcardExpiry,

        finalData.netsuiteEndpoint,

        finalData.threshold,

        finalData.email,
        finalData.facebook,

        current.id,
      ]
    );
  }
}



// ================= SAVE TIERS =================
// ================= SAVE TIERS =================
async function saveTiers(tiers) {

  // helper: "" -> null
  const clean = (v) => (v === "" || v === undefined ? null : v);

  const existingTiers = await pool.query(
    `
    SELECT id, tier_name, level
    FROM netst_loyalty_tiers_table
    `
  );

  let maxLevel = existingTiers.rows.reduce((max, row) => {
    const parsed = Number(row.level);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);

  const existingIds = new Set(existingTiers.rows.map((row) => row.id));

  for (const tier of tiers) {

    const id = clean(tier.id);
    const name = clean(tier.name);
    const threshold = clean(tier.threshold);
    const points = clean(tier.points);
    const active = tier.active ?? true;

    // skip empty rows
    if (!name) continue;

    const isExistingRow = id !== null && existingIds.has(Number(id));

    if (isExistingRow) {
      await pool.query(
        `
        UPDATE netst_loyalty_tiers_table
        SET
          tier_name = $1,
          threshold = $2,
          points_per_dollar = $3,
          status = $4,
          updated_at = NOW()
        WHERE id = $5
        `,
        [
          name,
          threshold,
          points,
          active,
          id,
        ]
      );
      continue;
    }

    let level = clean(tier.level);
    if (level === null) {
      maxLevel += 1;
      level = maxLevel;
    }

    await pool.query(
      `
      INSERT INTO netst_loyalty_tiers_table
      (tier_name, threshold, points_per_dollar, level, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      `,
      [
        name,
        threshold,
        points,
        level,
        active,
      ]
    );
  }
}



module.exports = {
  saveConfig,
  saveTiers,
};
