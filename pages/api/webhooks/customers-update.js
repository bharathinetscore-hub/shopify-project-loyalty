import crypto from "crypto";
import pool from "../../../db/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

function cleanText(value) {
  return String(value || "").trim();
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function buildCustomerName(firstName, lastName) {
  return [cleanText(firstName), cleanText(lastName)].filter(Boolean).join(" ").trim();
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

async function syncExistingCustomerIdentity({ customerIdRaw, customerIdParsed, customerEmail, customerName }) {
  const lookupRes = await pool.query(
    `
      SELECT customer_id
      FROM netst_customers_table
      WHERE (
        ($1::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($1))
        OR ($2::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($2))
        OR ($2::text <> '' AND regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $2)
        OR ($3::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($3)))
      )
      ORDER BY
        CASE
          WHEN ($2::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($2)) THEN 1
          WHEN ($2::text <> '' AND regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $2) THEN 2
          WHEN ($1::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($1)) THEN 3
          WHEN ($3::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($3))) THEN 4
          ELSE 5
        END,
        updated_at DESC NULLS LAST,
        id DESC
      LIMIT 1
    `,
    [customerIdRaw || "", customerIdParsed || "", customerEmail || ""]
  );

  const matchedCustomerId = cleanText(lookupRes.rows[0]?.customer_id);
  if (!matchedCustomerId) {
    return false;
  }

  await pool.query(
    `
      UPDATE netst_customers_table
      SET
        customer_name = COALESCE(NULLIF($2, ''), customer_name),
        customer_email = COALESCE(NULLIF($3, ''), customer_email),
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $1
    `,
    [matchedCustomerId, cleanText(customerName), cleanText(customerEmail) || null]
  );

  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const rawBody = await readRawBody(req);
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const webhookSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY;

    if (!verifyWebhookHmac(rawBody, hmacHeader, webhookSecret)) {
      return res.status(401).send("Invalid webhook signature");
    }

    const payload = JSON.parse(rawBody || "{}");
    const customerIdRaw = cleanText(payload?.admin_graphql_api_id || payload?.id);
    const customerIdParsed = parseCustomerId(payload?.id || payload?.admin_graphql_api_id);
    const customerEmail = cleanText(payload?.email);
    const customerName =
      buildCustomerName(payload?.first_name, payload?.last_name) ||
      cleanText(payload?.default_address?.name) ||
      "";

    await ensureCustomersTable();
    await syncExistingCustomerIdentity({
      customerIdRaw,
      customerIdParsed,
      customerEmail,
      customerName,
    });

    return res.status(200).send("ok");
  } catch (error) {
    console.error("customers-update webhook error:", error);
    return res.status(500).send("Webhook processing failed");
  }
}
