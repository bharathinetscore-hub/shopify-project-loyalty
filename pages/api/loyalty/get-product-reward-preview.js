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

async function getGlobalMultiplier() {
  const configRes = await pool.query(
    `
    SELECT each_point_value
    FROM netst_loyalty_config_table
    ORDER BY id DESC
    LIMIT 1
    `
  );

  return toNumber(configRes.rows[0]?.each_point_value, 1);
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

    const globalMultiplier = await getGlobalMultiplier();
    const enableCollection = Boolean(item.enable_collection_type);
    const collectionType = cleanText(item.collection_type).toLowerCase();

    let calculatedPoints = 0;

    if (!enableCollection) {
      calculatedPoints = productPrice * globalMultiplier;
    } else if (collectionType === "points") {
      calculatedPoints = toNumber(item.points_based_points, 0);
    } else if (collectionType === "amount") {
      const skuMultiplier = toNumber(item.sku_based_points, 0);
      const bestMultiplier = Math.max(globalMultiplier, skuMultiplier);
      calculatedPoints = productPrice * bestMultiplier;
    } else {
      calculatedPoints = productPrice * globalMultiplier;
    }

    const points = Math.max(0, Math.round(calculatedPoints));
    return res.status(200).json({
      eligible: points > 0,
      points,
      message: points > 0 ? `Earn ${points} points` : "",
      meta: {
        globalMultiplier,
        collectionType: enableCollection ? collectionType || "default" : "disabled",
      },
    });
  } catch (error) {
    console.error("get-product-reward-preview error:", error);
    return res.status(500).json({ error: "Failed to calculate reward preview" });
  }
}
