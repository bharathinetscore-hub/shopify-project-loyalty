import pool from "../../../db/db";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const id = req.body?.id ? Number(req.body.id) : null;
    const eventId = String(req.body?.eventId || "").trim();
    const eventName = String(req.body?.eventName || "").trim();
    const nsId = String(req.body?.nsId || "").trim();
    const isActive = req.body?.isActive === undefined ? true : !!req.body.isActive;

    if (!eventId || !eventName) {
      return res.status(400).json({ error: "eventId and eventName are required" });
    }

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
        [nsId || null, eventId, eventName, isActive, id]
      );
    } else {
      await pool.query(
        `
        INSERT INTO netst_events_table (ns_id, event_id, event_name, is_active)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (event_id)
        DO UPDATE SET
          ns_id = EXCLUDED.ns_id,
          event_name = EXCLUDED.event_name,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
        `,
        [nsId || null, eventId, eventName, isActive]
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("save-event error:", error);
    return res.status(500).json({ error: "Failed to save event" });
  }
}
