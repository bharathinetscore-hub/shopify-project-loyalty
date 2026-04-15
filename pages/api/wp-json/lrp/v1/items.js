import pool from "../../../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function parseItemId(value) {
  if (!value) return "";
  const raw = cleanText(value);
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;
  return raw.match(/\d+/)?.[0] || "";
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

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeCollectionType(value) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "sku" || normalized === "amount") return "amount";
  return "points";
}

async function ensureItemsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_product_item (
      id BIGSERIAL PRIMARY KEY,
      item_id BIGINT NOT NULL UNIQUE,
      product_name TEXT NULL,
      product_sku TEXT NULL,
      is_eligible_for_loyalty_program BOOLEAN DEFAULT FALSE,
      enable_collection_type BOOLEAN DEFAULT FALSE,
      collection_type VARCHAR(32) DEFAULT 'points',
      points_based_points DECIMAL(10,2) DEFAULT 0.00,
      sku_based_points DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE netst_product_item
    ADD COLUMN IF NOT EXISTS product_name TEXT,
    ADD COLUMN IF NOT EXISTS product_sku TEXT
  `);
}

function mapItemRow(row) {
  const dbCollectionType = cleanText(row.collection_type).toLowerCase() === "amount" ? "amount" : "points";
  return {
    productId: String(row.item_id || ""),
    productName: cleanText(row.product_name),
    productSku: cleanText(row.product_sku),
    isEligibleForLoyaltyProgram: Boolean(row.is_eligible_for_loyalty_program),
    enableCollectionType: Boolean(row.enable_collection_type),
    collectionType: dbCollectionType === "amount" ? "sku" : "points",
    pointsValue: Number(row.points_based_points || 0),
    skuValue: Number(row.sku_based_points || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function loadItems({ q = "", productId = "" } = {}) {
  const parsedId = parseItemId(productId);
  const result = await pool.query(
    `
    SELECT
      item_id,
      product_name,
      product_sku,
      is_eligible_for_loyalty_program,
      enable_collection_type,
      collection_type,
      points_based_points,
      sku_based_points,
      created_at,
      updated_at
    FROM netst_product_item
    WHERE (
      ($1::text = '' OR CAST(item_id AS TEXT) = $1)
      AND (
        $2::text = ''
        OR CAST(item_id AS TEXT) ILIKE '%' || $2 || '%'
        OR COALESCE(product_name, '') ILIKE '%' || $2 || '%'
        OR COALESCE(product_sku, '') ILIKE '%' || $2 || '%'
      )
    )
    ORDER BY updated_at DESC NULLS LAST, item_id DESC
    LIMIT 1000
    `,
    [parsedId, cleanText(q)]
  );

  return result.rows.map(mapItemRow);
}

async function loadItemsByIds(productIds = []) {
  const normalizedIds = [...new Set(productIds.map(parseItemId).filter(Boolean))];
  if (!normalizedIds.length) return [];

  const result = await pool.query(
    `
    SELECT
      item_id,
      product_name,
      product_sku,
      is_eligible_for_loyalty_program,
      enable_collection_type,
      collection_type,
      points_based_points,
      sku_based_points,
      created_at,
      updated_at
    FROM netst_product_item
    WHERE item_id = ANY($1::bigint[])
    ORDER BY updated_at DESC NULLS LAST, item_id DESC
    `,
    [normalizedIds]
  );

  return result.rows.map(mapItemRow);
}

function normalizeItemPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  const itemInput = raw.item && typeof raw.item === "object" ? raw.item : raw;

  return {
    productId: parseItemId(itemInput.productId ?? itemInput.item_id ?? itemInput.itemId),
    productName: cleanText(itemInput.productName ?? itemInput.product_name),
    productSku: cleanText(itemInput.productSku ?? itemInput.product_sku),
    isEligibleForLoyaltyProgram: toBoolean(
      itemInput.isEligibleForLoyaltyProgram ?? itemInput.is_eligible_for_loyalty_program,
      false
    ),
    enableCollectionType: toBoolean(
      itemInput.enableCollectionType ?? itemInput.enable_collection_type,
      false
    ),
    collectionType: normalizeCollectionType(itemInput.collectionType ?? itemInput.collection_type),
    pointsValue: toNumber(itemInput.pointsValue ?? itemInput.points_based_points, 0),
    skuValue: toNumber(itemInput.skuValue ?? itemInput.sku_based_points, 0),
  };
}

function normalizeItemsPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  if (Array.isArray(raw.items)) {
    return raw.items.map((item) => normalizeItemPayload({ item })).filter((item) => item.productId);
  }

  const single = normalizeItemPayload(raw);
  return single.productId ? [single] : [];
}

function normalizeDeletePayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  return raw.delete && typeof raw.delete === "object" ? raw.delete : raw;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      await ensureItemsTable();
      const productIds = Array.isArray(req.query.productIds)
        ? req.query.productIds
        : cleanText(req.query.productIds)
          ? cleanText(req.query.productIds).split(",")
          : [];

      const items = productIds.length
        ? await loadItemsByIds(productIds)
        : await loadItems({
            q: req.query.q,
            productId: req.query.productId,
          });

      return res.status(200).json({
        success: true,
        items,
        item: req.query.productId && !productIds.length ? items[0] || null : null,
      });
    } catch (error) {
      console.error("wp-json/lrp/v1/items GET error:", error);
      return res.status(500).json({ success: false, error: "Failed to load items" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await ensureItemsTable();
      const payload = normalizeDeletePayload(req.body);
      const productIds = [
        ...(Array.isArray(payload.productIds) ? payload.productIds : []),
        ...(Array.isArray(payload.item_ids) ? payload.item_ids : []),
      ]
        .map(parseItemId)
        .filter(Boolean);
      const singleProductId = parseItemId(payload.productId ?? payload.item_id ?? payload.itemId);
      if (singleProductId) productIds.push(singleProductId);
      const normalizedIds = [...new Set(productIds)];

      if (!normalizedIds.length) {
        return res.status(400).json({
          success: false,
          error: "productId or productIds is required",
        });
      }

      const result = await pool.query(
        `
        DELETE FROM netst_product_item
        WHERE item_id = ANY($1::bigint[])
        RETURNING
          item_id,
          product_name,
          product_sku,
          is_eligible_for_loyalty_program,
          enable_collection_type,
          collection_type,
          points_based_points,
          sku_based_points,
          created_at,
          updated_at
        `,
        [normalizedIds]
      );

      return res.status(200).json({
        success: true,
        deletedItem: result.rows[0] ? mapItemRow(result.rows[0]) : null,
        deletedItems: result.rows.map(mapItemRow),
        items: await loadItems(),
      });
    } catch (error) {
      console.error("wp-json/lrp/v1/items DELETE error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete item" });
    }
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    await ensureItemsTable();
    const payloads = normalizeItemsPayload(req.body);

    if (!payloads.length) {
      return res.status(400).json({ success: false, error: "productId is required" });
    }

    const savedRows = [];
    for (const payload of payloads) {
      const result = await pool.query(
        `
        INSERT INTO netst_product_item (
          item_id,
          product_name,
          product_sku,
          is_eligible_for_loyalty_program,
          enable_collection_type,
          collection_type,
          points_based_points,
          sku_based_points,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (item_id)
        DO UPDATE SET
          product_name = COALESCE(EXCLUDED.product_name, netst_product_item.product_name),
          product_sku = COALESCE(EXCLUDED.product_sku, netst_product_item.product_sku),
          is_eligible_for_loyalty_program = EXCLUDED.is_eligible_for_loyalty_program,
          enable_collection_type = EXCLUDED.enable_collection_type,
          collection_type = EXCLUDED.collection_type,
          points_based_points = EXCLUDED.points_based_points,
          sku_based_points = EXCLUDED.sku_based_points,
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          item_id,
          product_name,
          product_sku,
          is_eligible_for_loyalty_program,
          enable_collection_type,
          collection_type,
          points_based_points,
          sku_based_points,
          created_at,
          updated_at
        `,
        [
          payload.productId,
          payload.productName || null,
          payload.productSku || null,
          payload.isEligibleForLoyaltyProgram,
          payload.enableCollectionType,
          payload.collectionType,
          payload.pointsValue,
          payload.skuValue,
        ]
      );
      if (result.rows[0]) savedRows.push(result.rows[0]);
    }

      return res.status(200).json({
        success: true,
        item: savedRows[0] ? mapItemRow(savedRows[0]) : null,
        savedItemsCount: savedRows.length,
        savedItems: savedRows.map(mapItemRow),
        items: await loadItems(),
      });
  } catch (error) {
    console.error("wp-json/lrp/v1/items save error:", error);
    return res.status(500).json({ success: false, error: "Failed to save item" });
  }
}
