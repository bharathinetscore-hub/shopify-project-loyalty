import pool from "../../../db/db";
import { ensureLoyaltyUserTableSchema, findLoyaltyUserByIdentity } from "../../../lib/loyalty-user-table";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { type, licenseKey, username, productCode } = req.body || {};

    if (!type || !licenseKey) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (type === "loyalty") {
      await ensureLoyaltyUserTableSchema(pool);

      const user = await findLoyaltyUserByIdentity(pool, {
        licenseKey,
        productCode,
        username,
        includeInactive: true,
      });

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      return res.status(200).json({
        success: true,
        user: {
          type: "loyalty",
          licenseKey: user.license_key,
          productCode: user.product_code || "",
          licenseUrl: user.license_url || "",
          planEnd: user.plan_end_date,
        },
      });
    }

    if (type === "netsuite") {
      const query = productCode
        ? `
          SELECT license_key, product_code, account_id, license_url, plan_end_date
          FROM "netst-lmp-netsuite-users"
          WHERE license_key = $1
            AND product_code = $2
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1
        `
        : `
          SELECT license_key, product_code, account_id, license_url, plan_end_date
          FROM "netst-lmp-netsuite-users"
          WHERE license_key = $1
          ORDER BY updated_at DESC NULLS LAST
          LIMIT 1
        `;

      const values = productCode ? [licenseKey, productCode] : [licenseKey];
      const result = await pool.query(query, values);

      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const user = result.rows[0];
      return res.status(200).json({
        success: true,
        user: {
          type: "netsuite",
          licenseKey: user.license_key,
          productCode: user.product_code,
          accountId: user.account_id,
          licenseUrl: user.license_url,
          planEnd: user.plan_end_date,
        },
      });
    }

    return res.status(400).json({ success: false, message: "Invalid user type" });
  } catch (error) {
    console.error("Refresh user error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
