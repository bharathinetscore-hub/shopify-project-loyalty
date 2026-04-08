import pool from "../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function toBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

async function ensureReviewRewardsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_review_rewards_table (
      id BIGSERIAL PRIMARY KEY,
      source_app TEXT NOT NULL DEFAULT 'manual',
      review_reference TEXT NOT NULL,
      customer_id TEXT NULL,
      customer_name TEXT NULL,
      customer_email TEXT NULL,
      product_id TEXT NULL,
      review_text TEXT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      rewarded BOOLEAN NOT NULL DEFAULT FALSE,
      reward_event_id INTEGER NULL,
      reward_event_name TEXT NULL,
      reward_points NUMERIC(10,2) DEFAULT 0.00,
      admin_notes TEXT NULL,
      external_created_at TIMESTAMP NULL,
      approved_at TIMESTAMP NULL,
      rewarded_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_netst_review_rewards_source_reference UNIQUE (source_app, review_reference)
    )
  `);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ensureReviewRewardsTable(pool);

    const q = cleanText(req.query.q);
    const source = cleanText(req.query.source);
    const status = cleanText(req.query.status).toLowerCase();

    let statusClause = "";
    if (status === "approved") {
      statusClause = "AND approved = TRUE";
    } else if (status === "pending") {
      statusClause = "AND approved = FALSE";
    } else if (status === "rewarded") {
      statusClause = "AND rewarded = TRUE";
    } else if (status === "unrewarded") {
      statusClause = "AND rewarded = FALSE";
    }

    const result = await pool.query(
      `
        SELECT
          id,
          source_app,
          review_reference,
          customer_id,
          customer_name,
          customer_email,
          product_id,
          review_text,
          review_status,
          approved,
          rewarded,
          reward_event_id,
          reward_event_name,
          reward_points,
          admin_notes,
          external_created_at,
          approved_at,
          rewarded_at,
          created_at,
          updated_at
        FROM netst_review_rewards_table
        WHERE (
          $1::text = ''
          OR COALESCE(source_app, '') ILIKE '%' || $1 || '%'
          OR COALESCE(review_reference, '') ILIKE '%' || $1 || '%'
          OR COALESCE(customer_name, '') ILIKE '%' || $1 || '%'
          OR COALESCE(customer_email, '') ILIKE '%' || $1 || '%'
          OR COALESCE(product_id, '') ILIKE '%' || $1 || '%'
          OR COALESCE(review_text, '') ILIKE '%' || $1 || '%'
        )
          AND ($2::text = '' OR LOWER(COALESCE(source_app, '')) = LOWER($2))
          ${statusClause}
        ORDER BY COALESCE(updated_at, created_at, NOW()) DESC, id DESC
        LIMIT 1000
      `,
      [q, source]
    );

    const reviews = result.rows.map((row) => ({
      id: Number(row.id || 0),
      sourceApp: cleanText(row.source_app) || "manual",
      reviewReference: cleanText(row.review_reference),
      customerId: cleanText(row.customer_id),
      customerName: cleanText(row.customer_name),
      customerEmail: cleanText(row.customer_email),
      productId: cleanText(row.product_id),
      reviewText: cleanText(row.review_text),
      reviewStatus: cleanText(row.review_status) || "pending",
      approved: toBoolean(row.approved),
      rewarded: toBoolean(row.rewarded),
      rewardEventId: row.reward_event_id == null ? null : Number(row.reward_event_id),
      rewardEventName: cleanText(row.reward_event_name),
      rewardPoints: Number(row.reward_points || 0),
      adminNotes: cleanText(row.admin_notes),
      externalCreatedAt: row.external_created_at || null,
      approvedAt: row.approved_at || null,
      rewardedAt: row.rewarded_at || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    }));

    return res.status(200).json({ reviews });
  } catch (error) {
    console.error("get-review-rewards error:", error);
    return res.status(500).json({ error: "Failed to load review rewards." });
  }
}
