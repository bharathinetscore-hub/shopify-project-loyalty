import pool from "../../../db/db";

async function ensureColumn(columnName, definitionSql) {
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
}

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

  await ensureColumn("customer_birthday", "customer_birthday DATE NULL");
  await ensureColumn("customer_anniversary", "customer_anniversary DATE NULL");
  await ensureColumn("customer_eligible_for_loyalty", "customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false");
  await ensureColumn("customer_referral_code", "customer_referral_code TEXT NULL");
  await ensureColumn("customer_used_referral_code", "customer_used_referral_code TEXT NULL");
  await ensureColumn("total_earned_points", "total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("total_redeemed_points", "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
}

function normalizeDisplayName(name, email, customerId) {
  const safeName = String(name || "").trim();
  const safeEmail = String(email || "").trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (safeName && !emailPattern.test(safeName) && safeName.toLowerCase() !== safeEmail.toLowerCase()) {
    return safeName;
  }

  return "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const q = String(req.query.q || "").trim();

    await ensureCustomersTable();

    const result = await pool.query(
      `
      SELECT
        id,
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
      FROM netst_customers_table
      WHERE (
        $1::text = ''
        OR customer_id ILIKE '%' || $1 || '%'
        OR customer_name ILIKE '%' || $1 || '%'
        OR COALESCE(customer_email, '') ILIKE '%' || $1 || '%'
      )
      ORDER BY id DESC
      LIMIT 1000
      `,
      [q]
    );

    const customers = result.rows.map((row) => ({
      id: String(row.customer_id || ""),
      name: normalizeDisplayName(row.customer_name, row.customer_email, row.customer_id),
      email: String(row.customer_email || ""),
      birthday: row.customer_birthday || null,
      anniversary: row.customer_anniversary || null,
      eligibleForLoyalty: Boolean(row.customer_eligible_for_loyalty),
      referralCode: String(row.customer_referral_code || ""),
      usedReferralCode: String(row.customer_used_referral_code || ""),
      totalEarnedPoints: Number(row.total_earned_points || 0),
      totalRedeemedPoints: Number(row.total_redeemed_points || 0),
      availablePoints: Number(row.available_points || 0),
      rowId: Number(row.id),
    }));

    return res.status(200).json({ customers });
  } catch (error) {
    console.error("get-saved-customers error:", error);
    return res.status(500).json({ error: "Failed to load saved customers" });
  }
}
