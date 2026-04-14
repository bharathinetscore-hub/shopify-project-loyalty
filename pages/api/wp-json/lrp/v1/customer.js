import pool from "../../../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function normalizeDate(input) {
  const raw = cleanText(input);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function toNumber(input, fallback = 0) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes", "on", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "inactive"].includes(normalized)) return false;
  return fallback;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value));
}

function normalizeCustomerName(name, email) {
  const safeName = cleanText(name);
  const safeEmail = cleanText(email);

  if (safeName && !looksLikeEmail(safeName) && safeName.toLowerCase() !== safeEmail.toLowerCase()) {
    return safeName;
  }

  return "";
}

function buildReferralCodeSeed(customerId, customerName) {
  const nameSeed = cleanText(customerName)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  const idSeed = parseCustomerId(customerId).slice(-4) || `${Date.now()}`.slice(-4);
  const randomSeed = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NSL-${nameSeed || "USER"}-${idSeed}${randomSeed}`;
}

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

async function generateUniqueReferralCode(customerId, customerName) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = buildReferralCodeSeed(customerId, customerName);
    const existing = await pool.query(
      `
      SELECT 1
      FROM netst_customers_table
      WHERE customer_referral_code = $1
      LIMIT 1
      `,
      [candidate]
    );

    if (!existing.rows.length) return candidate;
  }

  return `NSL-${parseCustomerId(customerId).slice(-6) || Date.now().toString().slice(-6)}-${Date.now()
    .toString()
    .slice(-4)}`;
}

function mapCustomerRow(row) {
  return {
    rowId: Number(row.id || 0),
    id: String(row.customer_id || ""),
    name: normalizeCustomerName(row.customer_name, row.customer_email),
    email: cleanText(row.customer_email),
    birthday: row.customer_birthday || null,
    anniversary: row.customer_anniversary || null,
    eligibleForLoyalty: Boolean(row.customer_eligible_for_loyalty),
    referralCode: cleanText(row.customer_referral_code),
    usedReferralCode: cleanText(row.customer_used_referral_code),
    totalEarnedPoints: Number(row.total_earned_points || 0),
    totalRedeemedPoints: Number(row.total_redeemed_points || 0),
    availablePoints: Number(row.available_points || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function normalizeCustomerPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  const customerInput = raw.customer && typeof raw.customer === "object" ? raw.customer : raw;

  const customerId =
    parseCustomerId(customerInput.customerId) ||
    parseCustomerId(customerInput.customer_id) ||
    parseCustomerId(customerInput.id);
  const customerEmail = cleanText(customerInput.customerEmail ?? customerInput.customer_email ?? customerInput.email);
  const customerName = cleanText(customerInput.customerName ?? customerInput.customer_name ?? customerInput.name);
  const birthday = normalizeDate(customerInput.birthday ?? customerInput.customer_birthday);
  const anniversary = normalizeDate(customerInput.anniversary ?? customerInput.customer_anniversary);
  const eligibleForLoyalty = toBoolean(
    customerInput.eligibleForLoyalty ?? customerInput.customer_eligible_for_loyalty,
    false
  );
  const referralCode = cleanText(
    customerInput.referralCode ?? customerInput.customer_referral_code
  );
  const usedReferralCode = cleanText(
    customerInput.usedReferralCode ?? customerInput.customer_used_referral_code
  );
  const totalEarnedPoints = toNumber(
    customerInput.totalEarnedPoints ?? customerInput.total_earned_points,
    0
  );
  const totalRedeemedPoints = toNumber(
    customerInput.totalRedeemedPoints ?? customerInput.total_redeemed_points,
    0
  );
  const availablePointsInput =
    customerInput.availablePoints ?? customerInput.available_points;
  const availablePoints =
    availablePointsInput === undefined || availablePointsInput === null || availablePointsInput === ""
      ? totalEarnedPoints - totalRedeemedPoints
      : toNumber(availablePointsInput, totalEarnedPoints - totalRedeemedPoints);

  return {
    customerId,
    customerEmail,
    customerName,
    birthday,
    anniversary,
    eligibleForLoyalty,
    referralCode,
    usedReferralCode,
    totalEarnedPoints,
    totalRedeemedPoints,
    availablePoints,
  };
}

function normalizeDeletePayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  return raw.delete && typeof raw.delete === "object" ? raw.delete : raw;
}

async function loadCustomers(q = "") {
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
      available_points,
      created_at,
      updated_at
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

  return result.rows.map(mapCustomerRow);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      await ensureCustomersTable();
      const q = cleanText(req.query.q);
      const customers = await loadCustomers(q);
      return res.status(200).json({ success: true, customers });
    } catch (error) {
      console.error("wp-json/lrp/v1/customer GET error:", error);
      return res.status(500).json({ success: false, error: "Failed to load customers" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await ensureCustomersTable();

      const payload = normalizeDeletePayload(req.body);
      const id = cleanText(payload.customerId ?? payload.customer_id ?? payload.id);
      const email = cleanText(payload.customerEmail ?? payload.customer_email ?? payload.email);

      if (!id && !email) {
        return res.status(400).json({
          success: false,
          error: "Send customerId/customer_id/id or customerEmail/customer_email/email to delete.",
        });
      }

      const result = await pool.query(
        `
        DELETE FROM netst_customers_table
        WHERE (
          ($1::text <> '' AND (
            customer_id = $1
            OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
          ))
          OR ($2::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2)))
        )
        RETURNING
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
          available_points,
          created_at,
          updated_at
        `,
        [parseCustomerId(id), email]
      );

      return res.status(200).json({
        success: true,
        deletedCustomersCount: result.rows.length,
        deletedCustomers: result.rows.map(mapCustomerRow),
        customers: await loadCustomers(),
      });
    } catch (error) {
      console.error("wp-json/lrp/v1/customer DELETE error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete customer" });
    }
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    await ensureCustomersTable();

    const payload = normalizeCustomerPayload(req.body);

    if (!payload.customerId) {
      return res.status(400).json({ success: false, error: "customerId is required" });
    }

    const safeName = normalizeCustomerName(payload.customerName, payload.customerEmail);
    const resolvedReferralCode =
      payload.referralCode || (await generateUniqueReferralCode(payload.customerId, safeName));

    const result = await pool.query(
      `
      INSERT INTO netst_customers_table (
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
        available_points,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (customer_id)
      DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_email = EXCLUDED.customer_email,
        customer_birthday = EXCLUDED.customer_birthday,
        customer_anniversary = EXCLUDED.customer_anniversary,
        customer_eligible_for_loyalty = EXCLUDED.customer_eligible_for_loyalty,
        customer_referral_code = EXCLUDED.customer_referral_code,
        customer_used_referral_code = EXCLUDED.customer_used_referral_code,
        total_earned_points = EXCLUDED.total_earned_points,
        total_redeemed_points = EXCLUDED.total_redeemed_points,
        available_points = EXCLUDED.available_points,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
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
        available_points,
        created_at,
        updated_at
      `,
      [
        payload.customerId,
        safeName,
        payload.customerEmail || null,
        payload.birthday,
        payload.anniversary,
        payload.eligibleForLoyalty,
        resolvedReferralCode || null,
        payload.usedReferralCode || null,
        payload.totalEarnedPoints,
        payload.totalRedeemedPoints,
        payload.availablePoints,
      ]
    );

    return res.status(200).json({
      success: true,
      customer: mapCustomerRow(result.rows[0] || {}),
      customers: await loadCustomers(),
    });
  } catch (error) {
    console.error("wp-json/lrp/v1/customer save error:", error);
    return res.status(500).json({ success: false, error: "Failed to save customer" });
  }
}
