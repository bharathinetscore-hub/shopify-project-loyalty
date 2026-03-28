import pool from "../../../db/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const q = String(req.query.q || "").trim();

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

    const result = await pool.query(`
      SELECT id, ns_id, event_id, event_name, is_active, created_at, updated_at
      FROM netst_events_table
      WHERE (
        $1::text = ''
        OR event_id ILIKE '%' || $1 || '%'
        OR event_name ILIKE '%' || $1 || '%'
      )
      ORDER BY id DESC
    `, [q]);

    const events = result.rows.map((row) => ({
      id: Number(row.id),
      nsId: row.ns_id || "",
      eventId: row.event_id || "",
      eventName: row.event_name || "",
      isActive: !!row.is_active,
    }));

    return res.status(200).json({ events });
  } catch (error) {
    console.error("get-events error:", error);
    return res.status(500).json({ error: "Failed to load events" });
  }
}
