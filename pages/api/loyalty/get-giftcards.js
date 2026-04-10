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
}

async function ensureEventDetailsTable() {
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
      event_id INTEGER DEFAULT NULL
    );
  `);
}

function cleanText(value) {
  return String(value || "").trim();
}

function formatStatus(row) {
  if (Boolean(row?.expired)) return "Expired";
  const expiry = cleanText(row?.points_expiration_date);
  if (!expiry) return "Active";
  const expiryDate = new Date(expiry);
  if (Number.isNaN(expiryDate.getTime())) return "Active";
  return expiryDate.getTime() < Date.now() ? "Expired" : "Active";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const email = cleanText(req.query.email);
    const code = cleanText(req.query.code);

    await ensureCustomersTable();
    await ensureEventDetailsTable();

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.customer_id,
        e.receiver_email,
        e.gift_code,
        e.amount,
        e.event_name,
        e.date_created,
        e.created_at,
        e.points_expiration_date,
        e.expired,
        c.customer_name,
        c.customer_email
      FROM netst_customer__event_details_table e
      LEFT JOIN netst_customers_table c
        ON c.customer_id = e.customer_id::text
      WHERE TRIM(COALESCE(e.gift_code, '')) <> ''
        AND ($1::text = '' OR LOWER(COALESCE(e.receiver_email, c.customer_email, '')) LIKE LOWER('%' || $1 || '%'))
        AND ($2::text = '' OR LOWER(COALESCE(e.gift_code, '')) LIKE LOWER('%' || $2 || '%'))
      ORDER BY COALESCE(e.created_at, NOW()) DESC, e.id DESC
      LIMIT 1000
      `,
      [email, code]
    );

    const giftcards = result.rows.map((row) => ({
      id: Number(row.id || 0),
      customerId: String(row.customer_id || ""),
      customerName: cleanText(row.customer_name),
      email: cleanText(row.receiver_email) || cleanText(row.customer_email) || "-",
      code: cleanText(row.gift_code),
      amount: Number(row.amount || 0),
      eventName: cleanText(row.event_name),
      status: formatStatus(row),
      created: row.created_at || row.date_created || null,
      expiryDate: row.points_expiration_date || null,
    }));

    return res.status(200).json({ giftcards });
  } catch (error) {
    console.error("get-giftcards error:", error);
    return res.status(500).json({ error: "Failed to load giftcards" });
  }
}
