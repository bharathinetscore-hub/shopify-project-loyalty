import pool from "../../../db/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = String(req.query.q || "").trim();
  const collectionType = String(req.query.collectionType || "all").trim().toLowerCase();
  const normalizedType =
    collectionType === "points" || collectionType === "amount" || collectionType === "all"
      ? collectionType
      : "all";

  try {
    const query = `
      SELECT
        item_id,
        COALESCE(product_name, '') AS product_name,
        is_eligible_for_loyalty_program,
        enable_collection_type,
        collection_type,
        points_based_points,
        sku_based_points,
        COALESCE(product_sku, '') AS product_sku,
        updated_at
      FROM netst_product_item
      WHERE is_eligible_for_loyalty_program = TRUE
        AND (
          $1::text = ''
          OR CAST(item_id AS TEXT) ILIKE '%' || $1 || '%'
          OR COALESCE(product_name, '') ILIKE '%' || $1 || '%'
        )
        AND (
          $2::text = 'all'
          OR collection_type = $2
        )
      ORDER BY updated_at DESC NULLS LAST, item_id DESC
      LIMIT 1000
    `;

    const result = await pool.query(query, [q, normalizedType]);
    const items = result.rows.map((row) => ({
      productId: String(row.item_id),
      productName: row.product_name || `Product ${row.item_id}`,
      eligibility: row.is_eligible_for_loyalty_program ? 1 : 0,
      enableCollection: !!row.enable_collection_type,
      collectionType: row.collection_type || "",
      pointsBased: Number(row.points_based_points || 0),
      skuBased: Number(row.sku_based_points || 0),
      sku: row.product_sku || "",
      updatedAt: row.updated_at || null,
    }));

    return res.status(200).json({ items });
  } catch (error) {
    console.error("get-enabled-items error:", error);
    return res.status(500).json({ error: "Failed to load enabled loyalty items" });
  }
}
