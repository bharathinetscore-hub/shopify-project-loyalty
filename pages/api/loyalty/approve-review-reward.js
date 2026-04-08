import pool from "../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWholeNumber(value, fallback = 0) {
  return Math.max(0, Math.floor(toNumber(value, fallback)));
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function buildPointsExpirationDate(days) {
  const safeDays = normalizeWholeNumber(days, 0);
  if (!safeDays) return null;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + safeDays);
  return formatDateOnly(nextDate);
}

async function ensureCustomersTable(db) {
  await db.query(`
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
    const check = await db.query(
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
      await db.query(`ALTER TABLE netst_customers_table ADD COLUMN ${definitionSql};`);
    }
  };

  await ensureColumn(
    "customer_eligible_for_loyalty",
    "customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false"
  );
  await ensureColumn("total_earned_points", "total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn(
    "total_redeemed_points",
    "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0"
  );
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
}

async function ensureEventDetailsTable(db) {
  await db.query(`
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
    )
  `);
}

async function ensureEventsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureConfigTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
      id SERIAL PRIMARY KEY,
      product_review_points NUMERIC(10,2) DEFAULT 0.00,
      points_expiration_days VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS product_review_points NUMERIC(10,2) DEFAULT 0.00
  `);
  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS points_expiration_days VARCHAR(255) DEFAULT NULL
  `);
}

async function ensureFeaturesTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_features_table (
      id SERIAL PRIMARY KEY,
      loyalty_eligible BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE netst_features_table
    ADD COLUMN IF NOT EXISTS loyalty_eligible BOOLEAN DEFAULT FALSE
  `);
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

async function loadReviewAwardConfig(db) {
  const result = await db.query(
    `
      SELECT product_review_points, points_expiration_days
      FROM netst_loyalty_config_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = result.rows[0] || {};
  return {
    reviewPoints: toNumber(row.product_review_points, 0),
    pointsExpirationDays: normalizeWholeNumber(row.points_expiration_days, 0),
  };
}

async function loadGlobalEligibility(db) {
  const result = await db.query(
    `
      SELECT loyalty_eligible
      FROM netst_features_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  return Boolean(result.rows[0]?.loyalty_eligible);
}

async function loadEventDefinition(db, eventId) {
  const result = await db.query(
    `
      SELECT event_id, event_name, is_active
      FROM netst_events_table
      WHERE event_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [String(eventId)]
  );

  const row = result.rows[0] || null;
  if (!row) return null;

  return {
    id: toNumber(row.event_id, eventId),
    name: cleanText(row.event_name),
    isActive: row.is_active !== false,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureCustomersTable(client);
    await ensureEventDetailsTable(client);
    await ensureEventsTable(client);
    await ensureConfigTable(client);
    await ensureFeaturesTable(client);
    await ensureReviewRewardsTable(client);

    const reviewEntryId = toNumber(req.body?.reviewEntryId, 0);
    let customerId = parseCustomerId(req.body?.customerId);
    let customerEmail = cleanText(req.body?.customerEmail);
    let reviewReference = cleanText(req.body?.reviewReference);
    let reviewComment = cleanText(req.body?.reviewComment);
    let productId = cleanText(req.body?.productId);

    let reviewEntry = null;
    if (reviewEntryId > 0) {
      const reviewEntryRes = await client.query(
        `
          SELECT *
          FROM netst_review_rewards_table
          WHERE id = $1
          LIMIT 1
        `,
        [reviewEntryId]
      );
      reviewEntry = reviewEntryRes.rows[0] || null;

      if (!reviewEntry) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Review entry not found." });
      }

      customerId = customerId || parseCustomerId(reviewEntry.customer_id);
      customerEmail = customerEmail || cleanText(reviewEntry.customer_email);
      reviewReference = reviewReference || cleanText(reviewEntry.review_reference);
      reviewComment = reviewComment || cleanText(reviewEntry.review_text) || cleanText(reviewEntry.admin_notes);
      productId = productId || cleanText(reviewEntry.product_id);

      if (!reviewEntry.approved) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Review must be approved before awarding points." });
      }

      if (reviewEntry.rewarded) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This review has already been rewarded." });
      }
    }

    if (!customerId && !customerEmail) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Customer ID or customer email is required." });
    }

    if (!reviewReference) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Review reference is required." });
    }

    const customerRes = await client.query(
      `
        SELECT
          customer_id,
          customer_name,
          customer_email,
          customer_eligible_for_loyalty,
          total_earned_points,
          total_redeemed_points,
          available_points
        FROM netst_customers_table
        WHERE (
          ($1::text <> '' AND customer_id = $1)
          OR ($2::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2)))
        )
        LIMIT 1
      `,
      [customerId, customerEmail]
    );

    const customer = customerRes.rows[0] || null;
    if (!customer) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Customer not found." });
    }

    const globalLoyaltyEnabled = await loadGlobalEligibility(client);
    if (!globalLoyaltyEnabled || !customer.customer_eligible_for_loyalty) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "Customer is not eligible for loyalty review rewards.",
      });
    }

    const reviewEvent = await loadEventDefinition(client, 8);
    if (!reviewEvent?.name) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Event 8 is not configured in the events table." });
    }

    if (reviewEvent.isActive === false) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Event 8 is inactive." });
    }

    const awardConfig = await loadReviewAwardConfig(client);
    if (awardConfig.reviewPoints <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Product review points are not configured." });
    }

    const duplicateMarker = `manual_review_reference:${reviewReference.toLowerCase()}`;
    const duplicateRes = await client.query(
      `
        SELECT id
        FROM netst_customer__event_details_table
        WHERE customer_id = $1
          AND event_id = 8
          AND LOWER(COALESCE(comments, '')) LIKE '%' || $2 || '%'
        LIMIT 1
      `,
      [toNumber(customerId, 0), duplicateMarker]
    );

    if (duplicateRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This review reward has already been approved." });
    }

    const currentTotalEarned = toNumber(customer.total_earned_points, 0);
    const currentTotalRedeemed = toNumber(customer.total_redeemed_points, 0);
    const currentAvailable = toNumber(customer.available_points, 0);
    const nextTotalEarned = currentTotalEarned + awardConfig.reviewPoints;
    const nextAvailable = currentAvailable + awardConfig.reviewPoints;
    const pointsExpirationDate = buildPointsExpirationDate(awardConfig.pointsExpirationDays);
    const comments = [
      duplicateMarker,
      productId ? `product_id:${productId}` : "",
      reviewComment ? `notes:${reviewComment}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await client.query(
      `
        INSERT INTO netst_customer__event_details_table (
          customer_id,
          date_created,
          event_name,
          points_earned,
          points_redeemed,
          points_left,
          transaction_id,
          amount,
          gift_code,
          receiver_email,
          refer_friend_id,
          comments,
          points_expiration_date,
          points_expiration_days,
          expired,
          points_type,
          created_at,
          updated_at,
          event_id
        )
        VALUES (
          $1, CURRENT_DATE, $2, $3, 0, $4, NULL, 0, NULL, $5, NULL, $6, $7, $8, FALSE, 'positive', NOW(), NOW(), 8
        )
      `,
      [
        toNumber(customerId, 0),
        reviewEvent.name,
        awardConfig.reviewPoints,
        nextAvailable,
        cleanText(customer.customer_email) || customerEmail || null,
        comments,
        pointsExpirationDate,
        awardConfig.pointsExpirationDays ? String(awardConfig.pointsExpirationDays) : null,
      ]
    );

    await client.query(
      `
        UPDATE netst_customers_table
        SET
          total_earned_points = $2,
          total_redeemed_points = $3,
          available_points = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = $1
      `,
      [customerId, nextTotalEarned, currentTotalRedeemed, nextAvailable]
    );

    if (reviewEntryId > 0) {
      await client.query(
        `
          UPDATE netst_review_rewards_table
          SET
            rewarded = TRUE,
            reward_event_id = 8,
            reward_event_name = $2,
            reward_points = $3,
            rewarded_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [reviewEntryId, reviewEvent.name, awardConfig.reviewPoints]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `${reviewEvent.name} points awarded successfully.`,
      awardedPoints: awardConfig.reviewPoints,
      event: {
        id: reviewEvent.id,
        name: reviewEvent.name,
      },
      customer: {
        id: cleanText(customer.customer_id) || customerId,
        name: cleanText(customer.customer_name),
        email: cleanText(customer.customer_email) || customerEmail,
        totalEarnedPoints: nextTotalEarned,
        totalRedeemedPoints: currentTotalRedeemed,
        availablePoints: nextAvailable,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("approve-review-reward error:", error);
    return res.status(500).json({ error: "Failed to approve review reward." });
  } finally {
    client.release();
  }
}
