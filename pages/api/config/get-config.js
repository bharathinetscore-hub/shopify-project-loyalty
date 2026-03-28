import pool from "../../../db/db";

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {

    const result = await pool.query(
      "SELECT * FROM netst_loyalty_config_table LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(200).json(null);
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: "DB error" });
  }
}
