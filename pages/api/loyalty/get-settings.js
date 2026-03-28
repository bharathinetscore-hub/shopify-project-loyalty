import pool from "../../../db/db";
import cors from "../../../lib/cors";

function getNumericId(gid) {
  if (!gid) return null;
  const parts = String(gid).split("/");
  const last = parts[parts.length - 1];
  const match = last.match(/\d+/);
  return match ? match[0] : null;
}

async function resolveLicenseStatus({ type, licenseKey, username, productCode }) {
  let row = null;
  const hasIdentity = Boolean(type && licenseKey);

  if (type === "loyalty" && licenseKey) {
    const loyaltyRes = await pool.query(
      `
      SELECT plan_end_date
      FROM "netst-lmp-users"
      WHERE license_key = $1
        AND ($2::text IS NULL OR username = $2)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [licenseKey, username || null]
    );
    row = loyaltyRes.rows[0] || null;
  } else if (type === "netsuite" && licenseKey) {
    const netsuiteRes = await pool.query(
      `
      SELECT plan_end_date
      FROM "netst-lmp-netsuite-users"
      WHERE license_key = $1
        AND ($2::text IS NULL OR product_code = $2)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [licenseKey, productCode || null]
    );
    row = netsuiteRes.rows[0] || null;
  } else {
    const fallbackRes = await pool.query(
      `
      SELECT plan_end_date
      FROM "netst-lmp-users"
      WHERE plan_end_date IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, plan_end_date DESC NULLS LAST
      LIMIT 1
      `
    );
    row = fallbackRes.rows[0] || null;
  }

  if (!hasIdentity && !row?.plan_end_date) {
    return {
      expired: true,
      planEnd: null,
      message: "License expired. Please renew it as soon as possible.",
    };
  }

  if (!row?.plan_end_date) {
    return {
      expired: true,
      planEnd: null,
      message: "License expired. Please renew it as soon as possible.",
    };
  }

  const planEnd = new Date(row.plan_end_date);
  if (Number.isNaN(planEnd.getTime())) {
    return {
      expired: true,
      planEnd: row.plan_end_date,
      message: "License expired. Please renew it as soon as possible.",
    };
  }

  const expired = Date.now() > planEnd.getTime();
  return {
    expired,
    planEnd: row.plan_end_date,
    message: expired ? "License expired. Please renew it as soon as possible." : "",
  };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawProductId = req.query.productId;

    if (!rawProductId) {
      return res.status(400).json({ error: "Missing productId" });
    }

    const itemId = getNumericId(decodeURIComponent(rawProductId));

    if (!itemId) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    const result = await pool.query(
      "SELECT * FROM netst_product_item WHERE item_id = $1::bigint",
      [itemId]
    );

    const licenseStatus = await resolveLicenseStatus({
      type: req.query.type,
      licenseKey: req.query.licenseKey,
      username: req.query.username,
      productCode: req.query.productCode,
    });

    return res.status(200).json({
      ...(result.rows[0] || {}),
      licenseExpired: licenseStatus.expired,
      planEnd: licenseStatus.planEnd,
      licenseMessage: licenseStatus.message || "",
    });
  } catch (err) {
    console.error("Get settings DB Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
