import pool from "../../../db/db";
import cors from "../../../lib/cors";

function getNumericId(gid) {
  if (!gid) return null;

  const decoded = decodeURIComponent(String(gid));
  const parts = decoded.split("/");
  const last = parts[parts.length - 1];
  const match = last.match(/^\d+$/) ? last : last.match(/\d+/)?.[0];

  return match || null;
}

async function resolveLicenseStatus({ type, licenseKey, username, productCode }) {
  let row = null;
  const hasIdentity = Boolean(type && licenseKey);

  if (type === "loyalty" && licenseKey) {
    const loyaltyRes = await pool.query(
      `
      SELECT plan_end_date
      FROM "netst-lmp-users"
      WHERE license_key = $1
        AND ($2::text IS NULL OR username = $2)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [licenseKey, username || null]
    );
    row = loyaltyRes.rows[0] || null;
  } else if (type === "netsuite" && licenseKey) {
    const netsuiteRes = await pool.query(
      `
      SELECT plan_end_date
      FROM "netst-lmp-netsuite-users"
      WHERE license_key = $1
        AND ($2::text IS NULL OR product_code = $2)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [licenseKey, productCode || null]
    );
    row = netsuiteRes.rows[0] || null;
  } else {
    const fallbackRes = await pool.query(
      `
      SELECT plan_end_date
      FROM "netst-lmp-users"
      WHERE plan_end_date IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, plan_end_date DESC NULLS LAST
      LIMIT 1
      `
    );
    row = fallbackRes.rows[0] || null;
  }

  if (!hasIdentity && !row?.plan_end_date) {
    return true;
  }

  if (!row?.plan_end_date) return true;
  const planEnd = new Date(row.plan_end_date);
  if (Number.isNaN(planEnd.getTime())) return true;
  return Date.now() > planEnd.getTime();
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      productId,
      productName,
      productSku,
      enableLoyalty,
      enableCollection,
      collectionType,
      pointsValue,
      skuMultiplier,
      type,
      licenseKey,
      username,
      productCode,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "Missing productId" });
    }

    const itemId = getNumericId(productId);

    if (!itemId) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    const isExpired = await resolveLicenseStatus({
      type,
      licenseKey,
      username,
      productCode,
    });

    if (isExpired) {
      return res.status(403).json({
        error: "License expired. Please renew it as soon as possible.",
      });
    }

    console.log("SAVE itemId:", itemId);

    await pool.query(`
      ALTER TABLE netst_product_item
      ADD COLUMN IF NOT EXISTS product_name TEXT,
      ADD COLUMN IF NOT EXISTS product_sku TEXT;
    `);

    const query = `
      INSERT INTO netst_product_item (
        item_id,
        product_name,
        product_sku,
        is_eligible_for_loyalty_program,
        enable_collection_type,
        collection_type,
        points_based_points,
        sku_based_points
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (item_id)
      DO UPDATE SET
        product_name = COALESCE(EXCLUDED.product_name, netst_product_item.product_name),
        product_sku = COALESCE(EXCLUDED.product_sku, netst_product_item.product_sku),
        is_eligible_for_loyalty_program = EXCLUDED.is_eligible_for_loyalty_program,
        enable_collection_type = EXCLUDED.enable_collection_type,
        collection_type = EXCLUDED.collection_type,
        points_based_points = EXCLUDED.points_based_points,
        sku_based_points = EXCLUDED.sku_based_points,
        updated_at = CURRENT_TIMESTAMP;
    `;

    const values = [
      itemId,
      productName ? String(productName) : null,
      productSku ? String(productSku) : null,
      !!enableLoyalty,
      !!enableCollection,
      collectionType || "points",
      Number(pointsValue) || 0,
      Number(skuMultiplier) || 0,
    ];

    await pool.query(query, values);

    return res.status(200).json({ success: true, itemId });
  } catch (err) {
    console.error("Save DB Error:", err);

    return res.status(500).json({
      error: "Database error",
    });
  }
}
