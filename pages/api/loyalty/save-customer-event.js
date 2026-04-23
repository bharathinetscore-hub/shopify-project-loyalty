import pool from "../../../db/db";
import { sendPointsEarnedEmail, sendPointsRedeemedEmail } from "../../../lib/points-email";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeDate(input) {
  const raw = cleanText(input);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function normalizePointsType(value) {
  const normalized = cleanText(value).toLowerCase();
  return normalized === "negative" ? "negative" : "positive";
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

  await ensureColumn("customer_birthday", "customer_birthday DATE NULL");
  await ensureColumn("customer_anniversary", "customer_anniversary DATE NULL");
  await ensureColumn(
    "customer_eligible_for_loyalty",
    "customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false"
  );
  await ensureColumn("customer_referral_code", "customer_referral_code TEXT NULL");
  await ensureColumn("customer_used_referral_code", "customer_used_referral_code TEXT NULL");
  await ensureColumn("total_earned_points", "total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("total_redeemed_points", "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
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

  await db.query(`
    ALTER TABLE netst_events_table
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
  `);
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

async function loadCustomer(db, customerId, customerEmail) {
  const result = await db.query(
    `
    SELECT
      id,
      customer_id,
      customer_name,
      customer_email,
      customer_eligible_for_loyalty,
      total_earned_points,
      total_redeemed_points,
      available_points
    FROM netst_customers_table
    WHERE (
      ($1::text <> '' AND (
        customer_id = $1
        OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
      ))
      OR ($2::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2)))
    )
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    [customerId, customerEmail]
  );

  return result.rows[0] || null;
}

async function loadEventDefinition(db, eventId) {
  if (!cleanText(eventId)) return null;

  const result = await db.query(
    `
    SELECT id, event_id, event_name, is_active
    FROM netst_events_table
    WHERE event_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [cleanText(eventId)]
  );

  return result.rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureCustomersTable(client);
    await ensureEventsTable(client);
    await ensureEventDetailsTable(client);

    const customerId = parseCustomerId(req.body?.customerId);
    const customerEmail = cleanText(req.body?.customerEmail);
    const eventId = cleanText(req.body?.eventId);
    const requestedEventName = cleanText(req.body?.eventName);
    const pointsType = normalizePointsType(req.body?.pointsType);
    const pointsValue = Math.max(0, toNumber(req.body?.pointsValue, NaN));
    const amount = toNumber(req.body?.amount, 0);
    const comments = cleanText(req.body?.comments);
    const dateCreated = normalizeDate(req.body?.dateCreated) || new Date().toISOString().slice(0, 10);

    if (!customerId && !customerEmail) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "customerId or customerEmail is required" });
    }

    if (!Number.isFinite(pointsValue) || pointsValue <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "pointsValue must be greater than 0" });
    }

    const customer = await loadCustomer(client, customerId, customerEmail);
    if (!customer) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Customer not found" });
    }

    const eventDefinition = await loadEventDefinition(client, eventId);
    const eventName = requestedEventName || cleanText(eventDefinition?.event_name);

    if (!eventName) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "eventId or eventName is required" });
    }

    const currentEarned = toNumber(customer.total_earned_points, 0);
    const currentRedeemed = toNumber(customer.total_redeemed_points, 0);
    const currentAvailable = toNumber(customer.available_points, currentEarned - currentRedeemed);

    let nextEarned = currentEarned;
    let nextRedeemed = currentRedeemed;
    let pointsEarned = 0;
    let pointsRedeemed = 0;

    if (pointsType === "negative") {
      if (pointsValue > currentAvailable) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Points redeemed cannot exceed available points (${currentAvailable.toFixed(2)})`,
        });
      }
      nextRedeemed += pointsValue;
      pointsRedeemed = pointsValue;
    } else {
      nextEarned += pointsValue;
      pointsEarned = pointsValue;
    }

    const nextAvailable = nextEarned - nextRedeemed;

    const insertRes = await client.query(
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
        $1, $2, $3, $4, $5, $6, NULL, $7, NULL, $8, NULL, $9, NULL, NULL, FALSE, $10, NOW(), NOW(), $11
      )
      RETURNING id, date_created, event_name, points_earned, points_redeemed, points_left, amount, points_type, event_id, created_at
      `,
      [
        toNumber(customer.customer_id, 0),
        dateCreated,
        eventName,
        pointsEarned,
        pointsRedeemed,
        nextAvailable,
        amount,
        cleanText(customer.customer_email) || null,
        comments || null,
        pointsType,
        eventDefinition ? toNumber(eventDefinition.event_id, 0) : null,
      ]
    );

    const customerRes = await client.query(
      `
      UPDATE netst_customers_table
      SET
        total_earned_points = $1,
        total_redeemed_points = $2,
        available_points = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $4
      RETURNING
        id,
        customer_id,
        customer_name,
        customer_email,
        customer_eligible_for_loyalty,
        total_earned_points,
        total_redeemed_points,
        available_points,
        customer_referral_code,
        customer_used_referral_code,
        customer_birthday,
        customer_anniversary
      `,
      [nextEarned, nextRedeemed, nextAvailable, cleanText(customer.customer_id)]
    );

    await client.query("COMMIT");

    const savedCustomer = customerRes.rows[0] || {};
    const savedEvent = insertRes.rows[0] || {};
    const recipientEmail = cleanText(savedCustomer.customer_email);
    const customerName = cleanText(savedCustomer.customer_name);
    const eventNameOut = cleanText(savedEvent.event_name);
    const availablePointsOut = toNumber(savedCustomer.available_points, 0);

    if (recipientEmail) {
      const emailPayload = {
        recipientEmail,
        customerName,
        eventName: eventNameOut,
        availablePoints: availablePointsOut,
        amount: toNumber(savedEvent.amount, 0),
        comments,
      };

      if (toNumber(savedEvent.points_earned, 0) > 0) {
        await sendPointsEarnedEmail({
          ...emailPayload,
          points: toNumber(savedEvent.points_earned, 0),
        }).catch((error) => console.error("save-customer-event earned email error:", error));
      }

      if (toNumber(savedEvent.points_redeemed, 0) > 0) {
        await sendPointsRedeemedEmail({
          ...emailPayload,
          points: toNumber(savedEvent.points_redeemed, 0),
        }).catch((error) => console.error("save-customer-event redeemed email error:", error));
      }
    }

    return res.status(200).json({
      success: true,
      customer: {
        id: String(savedCustomer.customer_id || ""),
        name: cleanText(savedCustomer.customer_name),
        email: cleanText(savedCustomer.customer_email),
        birthday: savedCustomer.customer_birthday || null,
        anniversary: savedCustomer.customer_anniversary || null,
        eligibleForLoyalty: Boolean(savedCustomer.customer_eligible_for_loyalty),
        referralCode: cleanText(savedCustomer.customer_referral_code),
        usedReferralCode: cleanText(savedCustomer.customer_used_referral_code),
        totalEarnedPoints: toNumber(savedCustomer.total_earned_points, 0),
        totalRedeemedPoints: toNumber(savedCustomer.total_redeemed_points, 0),
        availablePoints: toNumber(savedCustomer.available_points, 0),
      },
      event: {
        id: Number(savedEvent.id || 0),
        date: savedEvent.date_created || null,
        createdAt: savedEvent.created_at || null,
        eventName: cleanText(savedEvent.event_name),
        amount: toNumber(savedEvent.amount, 0),
        pointsEarned: toNumber(savedEvent.points_earned, 0),
        pointsRedeemed: toNumber(savedEvent.points_redeemed, 0),
        pointsLeft: toNumber(savedEvent.points_left, 0),
        pointsType: cleanText(savedEvent.points_type) || pointsType,
        eventId: savedEvent.event_id != null ? String(savedEvent.event_id) : "",
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    console.error("save-customer-event error:", error);
    return res.status(500).json({ error: "Failed to save customer event" });
  } finally {
    client.release();
  }
}
