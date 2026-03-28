import pool from "../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const customerId = cleanText(req.query.customerId);
    const email = cleanText(req.query.email);

    if (!customerId && !email) {
      return res.status(400).json({ error: "customerId or email is required" });
    }

    await ensureEventDetailsTable();

    const result = await pool.query(
      `
      SELECT
        id,
        date_created,
        event_name,
        amount,
        points_earned,
        points_redeemed,
        points_left,
        created_at
      FROM netst_customer__event_details_table
      WHERE (
        ($1::text <> '' AND customer_id::text = $1)
        OR ($2::text <> '' AND LOWER(TRIM(COALESCE(receiver_email, ''))) = LOWER(TRIM($2)))
      )
      ORDER BY COALESCE(created_at, NOW()) DESC, id DESC
      LIMIT 1000
      `,
      [customerId, email]
    );

    const events = result.rows.map((row) => ({
      id: Number(row.id || 0),
      date: row.date_created || null,
      createdAt: row.created_at || null,
      eventName: cleanText(row.event_name) || "-",
      amount: toNumber(row.amount, 0),
      pointsEarned: toNumber(row.points_earned, 0),
      pointsRedeemed: toNumber(row.points_redeemed, 0),
      pointsLeft: toNumber(row.points_left, 0),
    }));

    return res.status(200).json({ events });
  } catch (error) {
    console.error("get-customer-events error:", error);
    return res.status(500).json({ error: "Failed to load customer events" });
  }
}
