import pool from "../../../db/db";

async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customers_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ensureColumn = async (columnName, definitionSql) => {
    const check = await pool.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'netst_customers_table'
        AND column_name = $1
      LIMIT 1
      `,
      [columnName]
    );
    if (!check.rows.length) {
      await pool.query(`ALTER TABLE netst_customers_table ADD COLUMN ${definitionSql};`);
    }
  };

  await ensureColumn("customer_birthday", "customer_birthday DATE NULL");
  await ensureColumn("customer_anniversary", "customer_anniversary DATE NULL");
  await ensureColumn("customer_eligible_for_loyalty", "customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false");
  await ensureColumn("customer_referral_code", "customer_referral_code TEXT NULL");
  await ensureColumn("customer_used_referral_code", "customer_used_referral_code TEXT NULL");
  await ensureColumn("total_earned_points", "total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("total_redeemed_points", "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
}

function normalizeDate(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function normalizeNumber(input) {
  if (input === null || input === undefined || input === "") return 0;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ensureCustomersTable();

    const customerId = String(req.body?.customerId || "").trim();
    const eligibleForLoyalty = Boolean(req.body?.eligibleForLoyalty);
    const birthday = normalizeDate(req.body?.birthday);
    const anniversary = normalizeDate(req.body?.anniversary);
    const referralCode = String(req.body?.referralCode || "").trim();
    const usedReferralCode = String(req.body?.usedReferralCode || "").trim();
    const totalEarnedPoints = normalizeNumber(req.body?.totalEarnedPoints);
    const totalRedeemedPoints = normalizeNumber(req.body?.totalRedeemedPoints);
    const requestedAvailablePoints = normalizeNumber(req.body?.availablePoints);
    const availablePoints =
      req.body?.availablePoints === null || req.body?.availablePoints === undefined || req.body?.availablePoints === ""
        ? totalEarnedPoints - totalRedeemedPoints
        : requestedAvailablePoints;

    if (!customerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    const result = await pool.query(
      `
      UPDATE netst_customers_table
      SET
        customer_eligible_for_loyalty = $2,
        customer_birthday = $3,
        customer_anniversary = $4,
        customer_referral_code = $5,
        customer_used_referral_code = $6,
        total_earned_points = $7,
        total_redeemed_points = $8,
        available_points = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $1
      RETURNING
        customer_id,
        customer_name,
        customer_email,
        customer_birthday,
        customer_anniversary,
        customer_eligible_for_loyalty,
        customer_referral_code,
        customer_used_referral_code,
        total_earned_points,
        total_redeemed_points,
        available_points
      `,
      [
        customerId,
        eligibleForLoyalty,
        birthday,
        anniversary,
        referralCode || null,
        usedReferralCode || null,
        totalEarnedPoints,
        totalRedeemedPoints,
        availablePoints,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      customer: {
        id: String(row.customer_id || ""),
        name: String(row.customer_name || ""),
        email: String(row.customer_email || ""),
        birthday: row.customer_birthday || null,
        anniversary: row.customer_anniversary || null,
        eligibleForLoyalty: Boolean(row.customer_eligible_for_loyalty),
        referralCode: String(row.customer_referral_code || ""),
        usedReferralCode: String(row.customer_used_referral_code || ""),
        totalEarnedPoints: Number(row.total_earned_points || 0),
        totalRedeemedPoints: Number(row.total_redeemed_points || 0),
        availablePoints: Number(row.available_points || 0),
      },
    });
  } catch (error) {
    console.error("save-customer-profile error:", error);
    return res.status(500).json({ error: "Failed to save customer profile" });
  }
}
