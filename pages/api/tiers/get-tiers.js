import pool from "../../../db/db";

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {

    const result = await pool.query(
      "SELECT * FROM netst_loyalty_tiers_table ORDER BY id ASC"
    );

    res.status(200).json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: "DB error" });
  }
}
