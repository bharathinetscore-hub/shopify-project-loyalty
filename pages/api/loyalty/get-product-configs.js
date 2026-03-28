import pool from "../../../db/db";

function parseIds(input) {
  if (!Array.isArray(input)) return [];
  const ids = input
    .map((value) => String(value || "").match(/\d+/)?.[0] || "")
    .filter(Boolean);
  return [...new Set(ids)];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const productIds = parseIds(req.body?.productIds || []);
    if (!productIds.length) {
      return res.status(200).json({ items: [] });
    }

    const result = await pool.query(
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

    const items = result.rows.map((row) => ({
      productId: String(row.item_id),
      enableLoyalty: !!row.is_eligible_for_loyalty_program,
      enableCollection: !!row.enable_collection_type,
      collectionType: row.collection_type === "amount" ? "sku" : "points",
      pointsValue: Number(row.points_based_points || 0),
      skuValue: Number(row.sku_based_points || 0),
    }));

    return res.status(200).json({ items });
  } catch (error) {
    console.error("get-product-configs error:", error);
    return res.status(500).json({ error: "Failed to load product configs" });
  }
}
