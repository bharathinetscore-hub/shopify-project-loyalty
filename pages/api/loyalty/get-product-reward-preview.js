import pool from "../../../db/db";

function setStorefrontCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Content-Type, Authorization"
  );
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanText(value) {
  return String(value || "").trim();
}

function parseProductId(value) {
  return cleanText(value).match(/\d+/)?.[0] || "";
}

function parseCustomerId(value) {
  return cleanText(value).match(/\d+/)?.[0] || "";
}

async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customers_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NULL,
      customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS available_points NUMERIC(12,2) NOT NULL DEFAULT 0
  `);
}

async function loadCustomerEligibility(customerId, customerEmail) {
  await ensureCustomersTable();

  const parsedCustomerId = parseCustomerId(customerId);
  if (parsedCustomerId) {
    const byId = await pool.query(
      `
        SELECT customer_eligible_for_loyalty
        FROM netst_customers_table
        WHERE (
          TRIM(COALESCE(customer_id, '')) = TRIM($1)
          OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
        )
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [parsedCustomerId]
    );

    if (byId.rows.length) {
      return Boolean(byId.rows[0]?.customer_eligible_for_loyalty);
    }
  }

  const normalizedEmail = cleanText(customerEmail);
  if (normalizedEmail) {
    const byEmail = await pool.query(
      `
        SELECT customer_eligible_for_loyalty
        FROM netst_customers_table
        WHERE LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($1))
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (byEmail.rows.length) {
      return Boolean(byEmail.rows[0]?.customer_eligible_for_loyalty);
    }
  }

  return null;
}

async function resolveLicenseStatus() {
  const tables = ['"netst-lmp-users"', '"netst-lmp-netsuite-users"'];

  for (const tableName of tables) {
    const result = await pool.query(
      `
      SELECT plan_end_date
      FROM ${tableName}
      WHERE plan_end_date IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, plan_end_date DESC NULLS LAST
      LIMIT 1
      `
    );

    const row = result.rows[0];
    if (!row?.plan_end_date) continue;

    const planEnd = new Date(row.plan_end_date);
    if (Number.isNaN(planEnd.getTime())) {
      return { expired: true, planEnd: row.plan_end_date };
    }

    return {
      expired: Date.now() > planEnd.getTime(),
      planEnd: row.plan_end_date,
    };
  }

  return { expired: true, planEnd: null };
}

async function getFeatureSettings() {
  const featuresRes = await pool.query(
    `
    SELECT loyalty_eligible, login_to_see_points
    FROM netst_features_table
    ORDER BY id DESC
    LIMIT 1
    `
  );

  return {
    loyaltyEligible: Boolean(featuresRes.rows[0]?.loyalty_eligible),
    loginToSeePoints: Boolean(featuresRes.rows[0]?.login_to_see_points),
  };
}

async function getLoyaltyPointValue() {
  const configRes = await pool.query(
    `
    SELECT loyalty_point_value
    FROM netst_loyalty_config_table
    ORDER BY id DESC
    LIMIT 1
    `
  );

  return toNumber(configRes.rows[0]?.loyalty_point_value, 1);
}

async function loadCustomerAvailablePoints(customerId, customerEmail) {
  await ensureCustomersTable();

  const parsedCustomerId = parseCustomerId(customerId);
  if (parsedCustomerId) {
    const byId = await pool.query(
      `
        SELECT available_points
        FROM netst_customers_table
        WHERE (
          TRIM(COALESCE(customer_id, '')) = TRIM($1)
          OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
        )
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [parsedCustomerId]
    );

    if (byId.rows.length) {
      return toNumber(byId.rows[0]?.available_points, 0);
    }
  }

  const normalizedEmail = cleanText(customerEmail);
  if (normalizedEmail) {
    const byEmail = await pool.query(
      `
        SELECT available_points
        FROM netst_customers_table
        WHERE LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($1))
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (byEmail.rows.length) {
      return toNumber(byEmail.rows[0]?.available_points, 0);
    }
  }

  return 0;
}

async function getCustomerTierPointsPerDollar(customerId, customerEmail) {
  const availablePoints = await loadCustomerAvailablePoints(customerId, customerEmail);
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

  if (!tierRes.rows.length) {
    return null;
  }

  return toNumber(tierRes.rows[0]?.points_per_dollar, null);
}

function getRequestValue(req, key) {
  if (req.method === "GET") {
    return req.query?.[key];
  }
  return req.body?.[key];
}

export default async function handler(req, res) {
  setStorefrontCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const license = await resolveLicenseStatus();
    if (license.expired) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "license_expired",
      });
    }

    const features = await getFeatureSettings();
    if (!features.loyaltyEligible) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "loyalty_disabled",
      });
    }

    const productId = parseProductId(getRequestValue(req, "productId"));
    const productPrice = toNumber(getRequestValue(req, "productPrice"), 0);
    const customerId = parseCustomerId(getRequestValue(req, "customerId"));
    const customerEmail = cleanText(getRequestValue(req, "customerEmail"));
    if (!productId || productPrice <= 0) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "invalid_product",
      });
    }

    const productRes = await pool.query(
      `
      SELECT
        is_eligible_for_loyalty_program,
        enable_collection_type,
        collection_type,
        points_based_points,
        sku_based_points
      FROM netst_product_item
      WHERE item_id = $1
      LIMIT 1
      `,
      [productId]
    );

    if (!productRes.rows.length) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "product_not_found",
      });
    }

    const item = productRes.rows[0];
    if (!Boolean(item.is_eligible_for_loyalty_program)) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "product_ineligible",
      });
    }

    const hasCustomerContext = Boolean(customerId || customerEmail);
    const customerEligible = await loadCustomerEligibility(customerId, customerEmail);

    if (features.loginToSeePoints && !hasCustomerContext) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "login_required",
      });
    }

    if (hasCustomerContext && customerEligible === false) {
      return res.status(200).json({
        eligible: false,
        points: 0,
        reason: "customer_ineligible",
      });
    }

    const loyaltyPointValue = await getLoyaltyPointValue();
    const tierPointsPerDollar = hasCustomerContext
      ? await getCustomerTierPointsPerDollar(customerId, customerEmail)
      : null;
    const enableCollection = Boolean(item.enable_collection_type);
    const collectionType = cleanText(item.collection_type).toLowerCase();

    let calculatedPoints = 0;

    if (!enableCollection) {
      calculatedPoints = productPrice * loyaltyPointValue;
    } else if (collectionType === "points") {
      calculatedPoints = toNumber(item.points_based_points, 0);
    } else if (collectionType === "amount") {
      const skuMultiplier = toNumber(item.sku_based_points, 0);
      const bestMultiplier = Math.max(
        skuMultiplier,
        loyaltyPointValue,
        toNumber(tierPointsPerDollar, 0)
      );
      calculatedPoints = productPrice * bestMultiplier;
    } else {
      calculatedPoints = productPrice * loyaltyPointValue;
    }

    const points = Math.max(0, Math.round(calculatedPoints));
    return res.status(200).json({
      eligible: points > 0,
      points,
      message: points > 0 ? `Earn ${points} points` : "",
      meta: {
        loyaltyPointValue,
        tierPointsPerDollar,
        collectionType: enableCollection ? collectionType || "default" : "disabled",
      },
    });
  } catch (error) {
    console.error("get-product-reward-preview error:", error);
    return res.status(500).json({ error: "Failed to calculate reward preview" });
  }
}
