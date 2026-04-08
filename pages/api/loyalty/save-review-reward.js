import pool from "../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function parseInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTimestamp(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ensureReviewRewardsTable(pool);

    const id = parseInteger(req.body?.id, null);
    const sourceApp = cleanText(req.body?.sourceApp) || "manual";
    const reviewReference = cleanText(req.body?.reviewReference);
    const customerId = cleanText(req.body?.customerId);
    const customerName = cleanText(req.body?.customerName);
    const customerEmail = cleanText(req.body?.customerEmail);
    const productId = cleanText(req.body?.productId);
    const reviewText = cleanText(req.body?.reviewText);
    const reviewStatus = cleanText(req.body?.reviewStatus) || "pending";
    const approved = Boolean(req.body?.approved);
    const adminNotes = cleanText(req.body?.adminNotes);
    const externalCreatedAt = normalizeTimestamp(req.body?.externalCreatedAt);

    if (!reviewReference) {
      return res.status(400).json({ error: "Review reference is required." });
    }

    if (!customerId && !customerEmail) {
      return res.status(400).json({ error: "Customer ID or customer email is required." });
    }

    let result;
    if (id) {
      result = await pool.query(
        `
          UPDATE netst_review_rewards_table
          SET
            source_app = $2,
            review_reference = $3,
            customer_id = $4,
            customer_name = $5,
            customer_email = $6,
            product_id = $7,
            review_text = $8,
            review_status = $9,
            approved = $10,
            approved_at = CASE
              WHEN $10 = TRUE AND approved = FALSE THEN CURRENT_TIMESTAMP
              WHEN $10 = FALSE THEN NULL
              ELSE approved_at
            END,
            admin_notes = $11,
            external_created_at = $12,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          sourceApp,
          reviewReference,
          customerId || null,
          customerName || null,
          customerEmail || null,
          productId || null,
          reviewText || null,
          reviewStatus,
          approved,
          adminNotes || null,
          externalCreatedAt,
        ]
      );
    } else {
      result = await pool.query(
        `
          INSERT INTO netst_review_rewards_table (
            source_app,
            review_reference,
            customer_id,
            customer_name,
            customer_email,
            product_id,
            review_text,
            review_status,
            approved,
            approved_at,
            admin_notes,
            external_created_at,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            CASE WHEN $9 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
            $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (source_app, review_reference)
          DO UPDATE SET
            customer_id = COALESCE(EXCLUDED.customer_id, netst_review_rewards_table.customer_id),
            customer_name = COALESCE(EXCLUDED.customer_name, netst_review_rewards_table.customer_name),
            customer_email = COALESCE(EXCLUDED.customer_email, netst_review_rewards_table.customer_email),
            product_id = COALESCE(EXCLUDED.product_id, netst_review_rewards_table.product_id),
            review_text = COALESCE(EXCLUDED.review_text, netst_review_rewards_table.review_text),
            review_status = EXCLUDED.review_status,
            approved = EXCLUDED.approved,
            approved_at = CASE
              WHEN EXCLUDED.approved = TRUE AND netst_review_rewards_table.approved = FALSE THEN CURRENT_TIMESTAMP
              WHEN EXCLUDED.approved = FALSE THEN NULL
              ELSE netst_review_rewards_table.approved_at
            END,
            admin_notes = COALESCE(EXCLUDED.admin_notes, netst_review_rewards_table.admin_notes),
            external_created_at = COALESCE(EXCLUDED.external_created_at, netst_review_rewards_table.external_created_at),
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [
          sourceApp,
          reviewReference,
          customerId || null,
          customerName || null,
          customerEmail || null,
          productId || null,
          reviewText || null,
          reviewStatus,
          approved,
          adminNotes || null,
          externalCreatedAt,
        ]
      );
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      review: {
        id: Number(row.id || 0),
        sourceApp: cleanText(row.source_app),
        reviewReference: cleanText(row.review_reference),
        customerId: cleanText(row.customer_id),
        customerName: cleanText(row.customer_name),
        customerEmail: cleanText(row.customer_email),
        productId: cleanText(row.product_id),
        reviewText: cleanText(row.review_text),
        reviewStatus: cleanText(row.review_status),
        approved: Boolean(row.approved),
        rewarded: Boolean(row.rewarded),
        rewardEventId: row.reward_event_id == null ? null : Number(row.reward_event_id),
        rewardEventName: cleanText(row.reward_event_name),
        rewardPoints: Number(row.reward_points || 0),
        adminNotes: cleanText(row.admin_notes),
        externalCreatedAt: row.external_created_at || null,
        approvedAt: row.approved_at || null,
        rewardedAt: row.rewarded_at || null,
      },
    });
  } catch (error) {
    console.error("save-review-reward error:", error);
    const message =
      error?.code === "23505"
        ? "That review reference already exists for this source app."
        : "Failed to save review reward.";
    return res.status(500).json({ error: message });
  }
}
