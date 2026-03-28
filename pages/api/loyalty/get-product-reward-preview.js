import pool from "../../../db/db";
import cors from "../../../lib/cors";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseProductId(value) {
  const id = String(value || "").match(/\d+/)?.[0] || "";
  return id;
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

async function getGlobalMultiplier() {
  const configRes = await pool.query(
    "SELECT each_point_value FROM netst_loyalty_config_table ORDER BY id DESC LIMIT 1"
  );
  return toNumber(configRes.rows[0]?.each_point_value, 1);
}

async function isGlobalLoyaltyEligible() {
  const featuresRes = await pool.query(
    "SELECT loyalty_eligible FROM netst_features_table ORDER BY id ASC LIMIT 1"
  );
  return Boolean(featuresRes.rows[0]?.loyalty_eligible);
}

async function getCustomerTierMultiplier(customerId) {
  if (!customerId) return null;

  const customerRes = await pool.query(
    `
    SELECT total_earned_points
    FROM netst_customers_table
    WHERE customer_id = $1
    LIMIT 1
    `,
    [customerId]
  );

  if (!customerRes.rows.length) return null;

  const earnedPoints = toNumber(customerRes.rows[0]?.total_earned_points, 0);
  const tierRes = await pool.query(
    `
    SELECT points_per_dollar
    FROM netst_loyalty_tiers_table
    WHERE COALESCE(status, false) = true
      AND COALESCE(threshold, 0) <= $1
    ORDER BY COALESCE(threshold, 0) DESC, id DESC
    LIMIT 1
    `,
    [earnedPoints]
  );

  if (!tierRes.rows.length) return null;
  return toNumber(tierRes.rows[0]?.points_per_dollar, null);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const globalEligibilityEnabled = await isGlobalLoyaltyEligible();
    if (!globalEligibilityEnabled) {
      return res.status(200).json({ eligible: false, points: 0 });
    }

    const productId = parseProductId(req.body?.productId);
    const customerId = parseCustomerId(req.body?.customerId);
    const productPrice = toNumber(req.body?.productPrice, 0);

    if (!productId || productPrice <= 0) {
      return res.status(200).json({ eligible: false, points: 0 });
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
      return res.status(200).json({ eligible: false, points: 0 });
    }

    const item = productRes.rows[0];
    const eligible = Boolean(item.is_eligible_for_loyalty_program);
    if (!eligible) {
      return res.status(200).json({ eligible: false, points: 0 });
    }

    const globalMultiplier = await getGlobalMultiplier();
    const tierMultiplier = await getCustomerTierMultiplier(customerId);
    const enableCollection = Boolean(item.enable_collection_type);
    const collectionType = String(item.collection_type || "").toLowerCase();

    let calculatedPoints = 0;

    // Rule 1: collection disabled -> price * (tier || config)
    if (!enableCollection) {
      const multiplier = tierMultiplier ?? globalMultiplier;
      calculatedPoints = productPrice * multiplier;
    }
    // Rule 2: fixed points
    else if (collectionType === "points") {
      calculatedPoints = toNumber(item.points_based_points, 0);
    }
    // Rule 3: amount based -> price * max(tier, config, sku)
    else if (collectionType === "amount") {
      const skuMultiplier = toNumber(item.sku_based_points, 0);
      const bestMultiplier = Math.max(tierMultiplier ?? 0, globalMultiplier, skuMultiplier);
      calculatedPoints = productPrice * bestMultiplier;
    } else {
      const multiplier = tierMultiplier ?? globalMultiplier;
      calculatedPoints = productPrice * multiplier;
    }

    const points = Math.round(calculatedPoints);
    return res.status(200).json({ eligible: true, points: Math.max(0, points) });
  } catch (error) {
    console.error("get-product-reward-preview error:", error);
    return res.status(500).json({ error: "Failed to calculate reward preview" });
  }
}
