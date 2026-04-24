import crypto from "crypto";
import pool from "../../../db/db";
import { sendPointsEarnedEmail, sendPointsRedeemedEmail } from "../../../lib/points-email";

export const config = {
  api: {
    bodyParser: false,
  },
};

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseCustomerId(value) {
  const match = String(value || "").match(/\d+/);
  return match ? String(match[0]) : "";
}

function cleanText(value) {
  return String(value || "").trim();
}

function getNoteAttributeMap(noteAttributes) {
  const entries = Array.isArray(noteAttributes) ? noteAttributes : [];
  return entries.reduce((acc, entry) => {
    const key = cleanText(entry?.name || entry?.key).toLowerCase();
    if (!key) return acc;
    acc[key] = cleanText(entry?.value);
    return acc;
  }, {});
}

function verifyWebhookHmac(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(String(hmacHeader)));
  } catch {
    return false;
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
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
      event_id INTEGER DEFAULT NULL,
      CONSTRAINT chk_netst_customer_event_points_type
        CHECK (points_type IN ('positive', 'negative'))
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_customer_id
    ON netst_customer__event_details_table (customer_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_event_name
    ON netst_customer__event_details_table (event_name);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_transaction_id
    ON netst_customer__event_details_table (transaction_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_refer_friend_id
    ON netst_customer__event_details_table (refer_friend_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_netst_customer_event_details_event_id
    ON netst_customer__event_details_table (event_id);
  `);
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

  await ensureColumn("customer_eligible_for_loyalty", "customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false");
  await ensureColumn("total_earned_points", "total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("total_redeemed_points", "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
}

async function loadCustomerPoints(customerId) {
  if (!customerId) {
    return {
      totalEarned: 0,
      totalRedeemed: 0,
      available: 0,
    };
  }

  const result = await pool.query(
    `
      SELECT total_earned_points, total_redeemed_points, available_points
      FROM netst_customers_table
      WHERE customer_id = $1
      LIMIT 1
    `,
    [String(customerId)]
  );

  const row = result.rows[0] || {};
  return {
    totalEarned: toNumber(row.total_earned_points, 0),
    totalRedeemed: toNumber(row.total_redeemed_points, 0),
    available: toNumber(row.available_points, 0),
  };
}

async function upsertCustomerPoints({
  customerId,
  customerName,
  customerEmail,
  totalEarned,
  totalRedeemed,
  available,
}) {
  if (!customerId) return;

  await pool.query(
    `
      INSERT INTO netst_customers_table (
        customer_id,
        customer_name,
        customer_email,
        total_earned_points,
        total_redeemed_points,
        available_points,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (customer_id)
      DO UPDATE SET
        customer_name = COALESCE(NULLIF(EXCLUDED.customer_name, ''), netst_customers_table.customer_name),
        customer_email = COALESCE(NULLIF(EXCLUDED.customer_email, ''), netst_customers_table.customer_email),
        total_earned_points = EXCLUDED.total_earned_points,
        total_redeemed_points = EXCLUDED.total_redeemed_points,
        available_points = EXCLUDED.available_points,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      String(customerId),
      cleanText(customerName) || "Unnamed Customer",
      cleanText(customerEmail) || null,
      totalEarned,
      totalRedeemed,
      available,
    ]
  );
}

async function getLoyaltyPointValue() {
  const configRes = await pool.query(
    "SELECT loyalty_point_value FROM netst_loyalty_config_table ORDER BY id DESC LIMIT 1"
  );
  return toNumber(configRes.rows[0]?.loyalty_point_value, 1);
}

async function getCustomerTierPointsPerDollar(customerId) {
  if (!customerId) return null;

  const customerRes = await pool.query(
    `
      SELECT available_points
      FROM netst_customers_table
      WHERE customer_id = $1
      LIMIT 1
    `,
    [customerId]
  );
  if (!customerRes.rows.length) return null;

  const availablePoints = toNumber(customerRes.rows[0]?.available_points, 0);
  const tierRes = await pool.query(
    `
      SELECT points_per_dollar
      FROM netst_loyalty_tiers_table
      WHERE COALESCE(status, false) = true
        AND COALESCE(threshold, 0) <= $1
      ORDER BY COALESCE(threshold, 0) DESC, id DESC
      LIMIT 1
    `,
    [availablePoints]
  );
  if (!tierRes.rows.length) return null;
  return toNumber(tierRes.rows[0]?.points_per_dollar, null);
}

async function getEventDefinition(eventId, fallbackName) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const eventRes = await pool.query(
    `
      SELECT event_id, event_name
      FROM netst_events_table
      WHERE event_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [String(eventId)]
  );
  const row = eventRes.rows[0] || null;
  return {
    id: Number(row?.event_id || eventId),
    name: String(row?.event_name || fallbackName),
  };
}

async function loadAvailablePoints(customerId, customerEmail) {
  const res = await pool.query(
    `
      SELECT points_earned, points_redeemed, points_type
      FROM netst_customer__event_details_table
      WHERE (
        ($1::text <> '' AND customer_id::text = $1)
        OR ($2::text <> '' AND LOWER(TRIM(COALESCE(receiver_email, ''))) = LOWER(TRIM($2)))
      )
    `,
    [customerId || "", customerEmail || ""]
  );

  const totals = res.rows.reduce(
    (acc, row) => {
      const type = cleanText(row.points_type).toLowerCase() || "positive";
      const earned = toNumber(row.points_earned, 0);
      const redeemed = toNumber(row.points_redeemed, 0);
      if (type === "negative") {
        acc.totalRedeemed += redeemed > 0 ? redeemed : Math.abs(earned);
      } else {
        acc.totalEarned += earned;
        acc.totalRedeemed += redeemed;
      }
      return acc;
    },
    { totalEarned: 0, totalRedeemed: 0 }
  );

  return {
    totalEarned: totals.totalEarned,
    totalRedeemed: totals.totalRedeemed,
    available: totals.totalEarned - totals.totalRedeemed,
  };
}

async function calculateOrderPoints({ customerId, lineItems }) {
  if (!Array.isArray(lineItems) || !lineItems.length) return 0;

  const productIds = lineItems
    .map((item) => toNumber(item?.product_id, 0))
    .filter((id) => id > 0);
  if (!productIds.length) return 0;

  const productsRes = await pool.query(
    `
      SELECT
        item_id,
        is_eligible_for_loyalty_program,
        enable_collection_type,
        collection_type,
        points_based_points,
        sku_based_points
      FROM netst_product_item
      WHERE item_id = ANY($1::bigint[])
    `,
    [productIds]
  );

  const productMap = new Map();
  for (const row of productsRes.rows) {
    productMap.set(String(row.item_id), row);
  }

  const loyaltyPointValue = await getLoyaltyPointValue();
  const tierPointsPerDollar = await getCustomerTierPointsPerDollar(customerId);

  let total = 0;
  for (const line of lineItems) {
    const productId = String(toNumber(line?.product_id, 0));
    if (!productId || productId === "0") continue;

    const product = productMap.get(productId);
    if (!product || !product.is_eligible_for_loyalty_program) continue;

    const quantity = Math.max(1, toNumber(line?.quantity, 1));
    const unitPrice = toNumber(line?.price, 0);
    const lineAmount = unitPrice * quantity;
    if (lineAmount <= 0) continue;

    const enableCollection = Boolean(product.enable_collection_type);
    const collectionType = String(product.collection_type || "").toLowerCase();

    if (!enableCollection) {
      total += lineAmount * loyaltyPointValue;
      continue;
    }

    if (collectionType === "points") {
      total += toNumber(product.points_based_points, 0) * quantity;
      continue;
    }

    if (collectionType === "amount") {
      const skuMultiplier = toNumber(product.sku_based_points, 0);
      const bestMultiplier = Math.max(
        skuMultiplier,
        loyaltyPointValue,
        toNumber(tierPointsPerDollar, 0)
      );
      total += lineAmount * bestMultiplier;
      continue;
    }

    total += lineAmount * loyaltyPointValue;
  }

  return Math.max(0, Math.round(total));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const rawBody = await readRawBody(req);
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const topic = String(req.headers["x-shopify-topic"] || "");
  const shop = String(req.headers["x-shopify-shop-domain"] || "").toLowerCase();

  if (!shop) {
    return res.status(400).send("Missing shop");
  }

  const isValid = verifyWebhookHmac(rawBody, hmac, process.env.SHOPIFY_API_SECRET_KEY);
  if (!isValid) {
    return res.status(401).send("Invalid webhook signature");
  }

  if (topic !== "orders/updated") {
    return res.status(200).send("Ignored");
  }

  try {
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const orderId = toNumber(payload?.id, 0);
    if (!orderId) return res.status(200).send("No order id");

    await ensureEventDetailsTable();
    await ensureCustomersTable();

    const customerId = parseCustomerId(payload?.customer?.id);
    const customerName = cleanText(
      [
        cleanText(payload?.customer?.first_name),
        cleanText(payload?.customer?.last_name),
      ]
        .filter(Boolean)
        .join(" ")
    );
    const receiverEmail = String(payload?.email || payload?.customer?.email || "").trim() || null;
    const noteAttributeMap = getNoteAttributeMap(payload?.note_attributes);
    const createdAt = payload?.created_at ? new Date(payload.created_at) : new Date();
    const dateCreated = createdAt.toISOString().slice(0, 10);
    const amount = toNumber(payload?.current_total_price ?? payload?.total_price, 0);
    const loyaltyRedeemPoints = toNumber(noteAttributeMap.netscore_loyalty_points, 0);
    const loyaltyDiscountAmount = toNumber(noteAttributeMap.netscore_loyalty_amount, 0);
    const loyaltyDiscountLabel = cleanText(noteAttributeMap.netscore_loyalty_label) || "Loyalty points applied";
    const loyaltyRuleId = cleanText(noteAttributeMap.netscore_loyalty_rule_id);
    const fulfillmentStatus = String(payload?.fulfillment_status || "").toLowerCase();

    const startingCustomerPoints = await loadCustomerPoints(customerId);
    let runningTotalEarned = startingCustomerPoints.totalEarned;
    let runningTotalRedeemed = startingCustomerPoints.totalRedeemed;
    let runningAvailable = startingCustomerPoints.available;

    if (loyaltyRedeemPoints > 0) {
      const checkoutRedeemEvent = await getEventDefinition(21, "Redeemed Points on Checkout");
      const existingRedeem = await pool.query(
        `
          SELECT id
          FROM netst_customer__event_details_table
          WHERE transaction_id = $1
            AND event_id = $2
          LIMIT 1
        `,
        [orderId, checkoutRedeemEvent.id]
      );

      if (!existingRedeem.rows.length) {
        const pointsLeft = Math.max(0, runningAvailable - loyaltyRedeemPoints);

        await pool.query(
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
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
            )
          `,
          [
            toNumber(customerId, 0),
            dateCreated,
            checkoutRedeemEvent.name,
            0,
            loyaltyRedeemPoints,
            pointsLeft,
            orderId,
            loyaltyDiscountAmount,
            null,
            receiverEmail,
            null,
            `Applied from checkout loyalty points (${loyaltyRuleId || loyaltyDiscountLabel})`,
            null,
            null,
            false,
            "negative",
            createdAt,
            new Date(),
            checkoutRedeemEvent.id,
          ]
        );

        runningTotalRedeemed += loyaltyRedeemPoints;
        runningAvailable = pointsLeft;

        await upsertCustomerPoints({
          customerId,
          customerName,
          customerEmail: receiverEmail,
          totalEarned: runningTotalEarned,
          totalRedeemed: runningTotalRedeemed,
          available: runningAvailable,
        });

        await sendPointsRedeemedEmail({
          recipientEmail: receiverEmail,
          customerName: customerName || "Customer",
          eventName: checkoutRedeemEvent.name,
          points: loyaltyRedeemPoints,
          availablePoints: runningAvailable,
          amount: loyaltyDiscountAmount,
          comments: `Applied from checkout loyalty points (${loyaltyRuleId || loyaltyDiscountLabel})`,
        }).catch((error) => console.error("orders-create redeemed email error:", error));
      }
    }

    if (fulfillmentStatus !== "fulfilled") {
      return res.status(200).send("Redeem recorded - awaiting fulfillment");
    }

    const pointsEarned = await calculateOrderPoints({
      customerId,
      lineItems: Array.isArray(payload?.line_items) ? payload.line_items : [],
    });

    const eventOne = await getEventDefinition(1, "Order Placed");
    const existing = await pool.query(
      `
        SELECT id
        FROM netst_customer__event_details_table
        WHERE transaction_id = $1
          AND event_id = $2
        LIMIT 1
      `,
      [orderId, eventOne.id]
    );
    if (existing.rows.length > 0) {
      return res.status(200).send("Order earned points already recorded");
    }

    const pointsLeftAfterEarn = Math.max(0, runningAvailable + pointsEarned);

    await pool.query(
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
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        )
      `,
      [
        toNumber(customerId, 0),
        dateCreated,
        eventOne.name,
        pointsEarned,
        0,
        pointsLeftAfterEarn,
        orderId,
        amount,
        null,
        receiverEmail,
        null,
        null,
        null,
        null,
        false,
        "positive",
        createdAt,
        new Date(),
        eventOne.id,
      ]
    );

    runningTotalEarned += pointsEarned;
    runningAvailable = pointsLeftAfterEarn;

    await upsertCustomerPoints({
      customerId,
      customerName,
      customerEmail: receiverEmail,
      totalEarned: runningTotalEarned,
      totalRedeemed: runningTotalRedeemed,
      available: runningAvailable,
    });

    await sendPointsEarnedEmail({
      recipientEmail: receiverEmail,
      customerName: customerName || "Customer",
      eventName: eventOne.name,
      points: pointsEarned,
      availablePoints: runningAvailable,
      amount,
      comments: "",
    }).catch((error) => console.error("orders-create earned email error:", error));

    return res.status(200).send("OK");
  } catch (error) {
    console.error("orders/updated webhook error:", error);
    return res.status(500).send("Webhook processing failed");
  }
}
