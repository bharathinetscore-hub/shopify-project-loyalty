import pool from "../../../db/db";

function normalizeCustomer(row = {}) {
  const rawId = String(row.id || "").trim();
  const id = rawId.includes("/") ? rawId.split("/").pop() : rawId;
  const name = String(row.name || "").trim();
  const email = String(row.email || "").trim();
  return {
    id,
    name: name || "Unnamed Customer",
    email,
  };
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = Array.isArray(req.body?.customers) ? req.body.customers : [];
    const customers = input.map(normalizeCustomer).filter((item) => item.id);

    if (!customers.length) {
      return res.status(400).json({ error: "No valid customers provided" });
    }

    await ensureCustomersTable();

    for (const customer of customers) {
      await pool.query(
        `
        INSERT INTO netst_customers_table (customer_id, customer_name, customer_email)
        VALUES ($1, $2, $3)
        ON CONFLICT (customer_id)
        DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          customer_email = EXCLUDED.customer_email,
          updated_at = CURRENT_TIMESTAMP
        `,
        [customer.id, customer.name, customer.email || null]
      );
    }

    return res.status(200).json({
      success: true,
      saved: customers.length,
    });
  } catch (error) {
    console.error("save-customers error:", error);
    return res.status(500).json({ error: "Failed to save customers" });
  }
}
