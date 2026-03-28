import pool from "../../../db/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = String(req.query.q || "").trim();
  const type = String(req.query.type || "all").trim().toLowerCase();
  const normalizedType = type === "points" || type === "amount" || type === "all" ? type : "all";

  try {
    const result = await pool.query(
      `
      SELECT
        item_id,
        COALESCE(product_name, '') AS product_name,
        is_eligible_for_loyalty_program,
        collection_type,
        points_based_points,
        sku_based_points,
        updated_at
      FROM netst_product_item
      WHERE (
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
      `,
      [q, normalizedType]
    );

    const items = result.rows.map((row) => {
      const rawType = row.collection_type || "points";
      const typeLabel = rawType === "amount" ? "SKU" : "Points";
      const points = rawType === "amount"
        ? Number(row.sku_based_points || 0)
        : Number(row.points_based_points || 0);

      return {
        productId: String(row.item_id),
        productName: row.product_name || `Product ${row.item_id}`,
        eligibility: !!row.is_eligible_for_loyalty_program,
        type: rawType,
        typeLabel,
        points,
      };
    });

    return res.status(200).json({ items });
  } catch (error) {
    console.error("get-items error:", error);
    return res.status(500).json({ error: "Failed to load items" });
  }
}
