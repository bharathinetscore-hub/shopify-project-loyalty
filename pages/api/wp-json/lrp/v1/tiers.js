import pool from "../../../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNullableNumberString(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num.toFixed(2) : null;
}

function toNullableInt(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.floor(num));
}

function toStatusBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (["active", "true", "1", "yes", "on"].includes(normalized)) return true;
  if (["inactive", "false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function toStatusLabel(value) {
  return value ? "active" : "inactive";
}

async function ensureTiersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_tiers_table (
      id SERIAL PRIMARY KEY,
      tier_name VARCHAR(100),
      threshold DECIMAL(10,2),
      points_per_dollar DECIMAL(10,2),
      ns_id VARCHAR(100),
      description TEXT,
      level INTEGER,
      status BOOLEAN,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS points_per_dollar DECIMAL(10,2)
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS ns_id VARCHAR(100)
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS description TEXT
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS level INTEGER
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS status BOOLEAN
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_tiers_table
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
  `);
}

function mapTierRow(row) {
  return {
    id: Number(row.id || 0),
    tier_name: cleanText(row.tier_name),
    NSID: cleanText(row.ns_id),
    description: row.description || "",
    status: toStatusLabel(Boolean(row.status)),
    threshold: row.threshold != null ? Number(row.threshold).toFixed(2) : null,
    points_for_currency:
      row.points_per_dollar != null ? Number(row.points_per_dollar).toFixed(2) : null,
    level: row.level != null ? Number(row.level) : null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

async function resolveTierByName(tierName) {
  const normalized = cleanText(tierName);
  if (!normalized) return null;

  const result = await pool.query(
    `
    SELECT *
    FROM netst_loyalty_tiers_table
    WHERE tier_name = $1
    LIMIT 1
    `,
    [normalized]
  );

  return result.rows[0] || null;
}

async function loadAllTiers() {
  const result = await pool.query(`
    SELECT *
    FROM netst_loyalty_tiers_table
    ORDER BY COALESCE(level, 0) ASC, id ASC
  `);

  return result.rows.map(mapTierRow);
}

async function getNextLevel() {
  const result = await pool.query(`
    SELECT MAX(level) AS max_level
    FROM netst_loyalty_tiers_table
  `);

  return Math.max(0, Number(result.rows[0]?.max_level || 0)) + 1;
}

function normalizeTierPayload(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    tier_name: cleanText(raw.tier_name ?? raw.name),
    tier_name_new: cleanText(raw.tier_name_new ?? raw.name_new),
    NSID: cleanText(raw.NSID ?? raw.ns_id),
    description: raw.description == null ? null : String(raw.description),
    status: raw.status,
    threshold: toNullableNumberString(raw.threshold),
    points_for_currency: toNullableNumberString(raw.points_for_currency ?? raw.points),
    level: toNullableInt(raw.level),
  };
}

function normalizeTierListPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  if (Array.isArray(raw.tiers)) {
    return raw.tiers.map(normalizeTierPayload);
  }
  return [normalizeTierPayload(raw)];
}

async function createTierSingle(payload) {
  if (!payload.tier_name) {
    return { status: 400, data: { message: "tier_name is required" } };
  }

  const existing = await resolveTierByName(payload.tier_name);
  if (existing) {
    return { status: 409, data: { message: "Tier name already exists" } };
  }

  const level = payload.level == null ? await getNextLevel() : payload.level;
  const now = new Date().toISOString();

  const result = await pool.query(
    `
    INSERT INTO netst_loyalty_tiers_table (
      tier_name,
      threshold,
      points_per_dollar,
      ns_id,
      description,
      level,
      status,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      payload.tier_name,
      payload.threshold,
      payload.points_for_currency,
      payload.NSID || null,
      payload.description || null,
      level,
      toStatusBoolean(payload.status, true),
      now,
      now,
    ]
  );

  return { status: 201, data: mapTierRow(result.rows[0] || {}) };
}

async function updateTierSingle(payload) {
  if (!payload.tier_name) {
    return { status: 400, data: { message: "tier_name is required" } };
  }

  const existing = await resolveTierByName(payload.tier_name);
  if (!existing) {
    return { status: 404, data: { message: "Tier not found" } };
  }

  const targetTierName = payload.tier_name_new || payload.tier_name;
  if (targetTierName !== payload.tier_name) {
    const conflict = await resolveTierByName(targetTierName);
    if (conflict && Number(conflict.id) !== Number(existing.id)) {
      return { status: 409, data: { message: "Target tier name already exists" } };
    }
  }

  if (payload.level != null) {
    const conflict = await pool.query(
      `
      SELECT id
      FROM netst_loyalty_tiers_table
      WHERE level = $1
        AND id <> $2
      LIMIT 1
      `,
      [payload.level, existing.id]
    );
    if (conflict.rows.length) {
      return { status: 409, data: { message: `Level ${payload.level} already exists` } };
    }
  }

  const nextData = {
    tier_name: targetTierName,
    ns_id: payload.NSID || existing.ns_id || null,
    description: payload.description !== null ? payload.description : existing.description,
    status: payload.status !== undefined ? toStatusBoolean(payload.status, Boolean(existing.status)) : Boolean(existing.status),
    threshold: payload.threshold !== null ? payload.threshold : existing.threshold,
    points_per_dollar:
      payload.points_for_currency !== null ? payload.points_for_currency : existing.points_per_dollar,
    level: payload.level != null ? payload.level : existing.level,
    updated_at: new Date().toISOString(),
  };

  const result = await pool.query(
    `
    UPDATE netst_loyalty_tiers_table
    SET
      tier_name = $1,
      ns_id = $2,
      description = $3,
      status = $4,
      threshold = $5,
      points_per_dollar = $6,
      level = $7,
      updated_at = $8
    WHERE id = $9
    RETURNING *
    `,
    [
      nextData.tier_name,
      nextData.ns_id,
      nextData.description,
      nextData.status,
      nextData.threshold,
      nextData.points_per_dollar,
      nextData.level,
      nextData.updated_at,
      existing.id,
    ]
  );

  return { status: 200, data: mapTierRow(result.rows[0] || {}) };
}

async function deleteTierSingle(tierName) {
  const existing = await resolveTierByName(tierName);
  if (!existing) {
    return { status: 404, data: { message: "Tier not found" } };
  }

  const deleted = await pool.query(
    `
    DELETE FROM netst_loyalty_tiers_table
    WHERE id = $1
    RETURNING *
    `,
    [existing.id]
  );

  return {
    status: 200,
    data: {
      message: "Tier deleted",
      tier: deleted.rows[0] ? mapTierRow(deleted.rows[0]) : null,
    },
  };
}

export default async function handler(req, res) {
  await ensureTiersTable();

  if (req.method === "GET") {
    try {
      const tierName = cleanText(req.query.tier_name);
      if (tierName) {
        const tier = await resolveTierByName(tierName);
        if (!tier) {
          return res.status(404).json({ message: "Tier not found" });
        }
        return res.status(200).json(mapTierRow(tier));
      }

      return res.status(200).json(await loadAllTiers());
    } catch (error) {
      console.error("wp-json/lrp/v1/tiers GET error:", error);
      return res.status(500).json({ message: "Failed to load tiers" });
    }
  }

  if (req.method === "POST") {
    try {
      const payloads = normalizeTierListPayload(req.body);
      const isBulk = Array.isArray(req.body?.tiers);

      if (isBulk) {
        const results = [];
        for (let index = 0; index < payloads.length; index += 1) {
          const result = await createTierSingle(payloads[index]);
          results.push({ status: result.status, data: result.data });
        }
        return res.status(200).json(results);
      }

      const result = await createTierSingle(payloads[0] || {});
      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error("wp-json/lrp/v1/tiers POST error:", error);
      return res.status(500).json({ message: "Failed to create tier" });
    }
  }

  if (req.method === "PUT") {
    try {
      const payloads = normalizeTierListPayload(req.body);
      const isBulk = Array.isArray(req.body?.tiers);

      if (isBulk) {
        const results = [];
        for (let index = 0; index < payloads.length; index += 1) {
          const result = await updateTierSingle(payloads[index]);
          results.push({ status: result.status, data: result.data });
        }
        return res.status(200).json(results);
      }

      const result = await updateTierSingle(payloads[0] || {});
      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error("wp-json/lrp/v1/tiers PUT error:", error);
      return res.status(500).json({ message: "Failed to update tier" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const tiers = Array.isArray(req.body?.tiers) ? req.body.tiers : null;
      if (tiers) {
        const results = [];
        for (let index = 0; index < tiers.length; index += 1) {
          const tierName = cleanText(tiers[index]?.tier_name ?? tiers[index]?.name);
          const result = await deleteTierSingle(tierName);
          results.push({
            tier_name: tierName,
            status: result.status,
            data: result.data,
          });
        }
        return res.status(200).json(results);
      }

      const tierName = cleanText(req.body?.tier_name ?? req.body?.name);
      if (!tierName) {
        return res.status(400).json({ message: "tier_name is required" });
      }

      const result = await deleteTierSingle(tierName);
      return res.status(result.status).json(result.data);
    } catch (error) {
      console.error("wp-json/lrp/v1/tiers DELETE error:", error);
      return res.status(500).json({ message: "Failed to delete tier" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}
