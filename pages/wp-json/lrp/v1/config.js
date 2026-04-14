import pool from "../../../../db/db";
import { saveConfig } from "../../../../models/LoyaltyConfig";

function cleanText(value) {
  return String(value || "").trim();
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes", "on", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "inactive"].includes(normalized)) return false;
  return fallback;
}

async function ensureEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE netst_events_table
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
}

async function loadConfigRow() {
  const result = await pool.query(`
    SELECT *
    FROM netst_loyalty_config_table
    ORDER BY id ASC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

async function loadEventsRows() {
  await ensureEventsTable();

  const result = await pool.query(`
    SELECT id, ns_id, event_id, event_name, is_active, created_at, updated_at
    FROM netst_events_table
    ORDER BY id DESC
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    nsId: row.ns_id || "",
    eventId: row.event_id || "",
    eventName: row.event_name || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function upsertEvent(eventInput) {
  const id = eventInput?.id ? Number(eventInput.id) : null;
  const eventId = cleanText(eventInput?.eventId);
  const eventName = cleanText(eventInput?.eventName);
  const nsId = cleanText(eventInput?.nsId) || null;
  const isActive = toBoolean(eventInput?.isActive, true);

  if (!eventId || !eventName) {
    throw new Error("Each event requires eventId and eventName.");
  }

  if (id) {
    await pool.query(
      `
      UPDATE netst_events_table
      SET
        ns_id = $1,
        event_id = $2,
        event_name = $3,
        is_active = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [nsId, eventId, eventName, isActive, id]
    );

    return { id, eventId, eventName, nsId: nsId || "", isActive };
  }

  const result = await pool.query(
    `
    INSERT INTO netst_events_table (ns_id, event_id, event_name, is_active)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (event_id)
    DO UPDATE SET
      ns_id = EXCLUDED.ns_id,
      event_name = EXCLUDED.event_name,
      is_active = EXCLUDED.is_active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, ns_id, event_id, event_name, is_active
    `,
    [nsId, eventId, eventName, isActive]
  );

  const row = result.rows[0] || {};
  return {
    id: Number(row.id || 0),
    eventId: row.event_id || eventId,
    eventName: row.event_name || eventName,
    nsId: row.ns_id || "",
    isActive: Boolean(row.is_active),
  };
}

function normalizeRequestPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  const config = raw.config && typeof raw.config === "object" ? raw.config : raw;

  const events = Array.isArray(raw.events)
    ? raw.events
    : raw.event && typeof raw.event === "object"
      ? [raw.event]
      : [];

  return { config, events };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const [config, events] = await Promise.all([loadConfigRow(), loadEventsRows()]);
      return res.status(200).json({ success: true, config, events });
    } catch (error) {
      console.error("wp-json/lrp/v1/config GET error:", error);
      return res.status(500).json({ success: false, error: "Failed to load config data" });
    }
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    await ensureEventsTable();

    const { config, events } = normalizeRequestPayload(req.body);
    const hasConfigPayload = Object.keys(config || {}).some((key) => !["events", "event"].includes(key));

    if (!hasConfigPayload && !events.length) {
      return res.status(400).json({
        success: false,
        error: "Send config fields, events array, or both.",
      });
    }

    if (hasConfigPayload) {
      await saveConfig(config);
    }

    const savedEvents = [];
    for (const event of events) {
      savedEvents.push(await upsertEvent(event));
    }

    const [latestConfig, latestEvents] = await Promise.all([loadConfigRow(), loadEventsRows()]);

    return res.status(200).json({
      success: true,
      updatedConfig: hasConfigPayload,
      updatedEventsCount: savedEvents.length,
      savedEvents,
      config: latestConfig,
      events: latestEvents,
    });
  } catch (error) {
    console.error("wp-json/lrp/v1/config save error:", error);
    return res.status(500).json({
      success: false,
      error: cleanText(error?.message) || "Failed to save config data",
    });
  }
}
