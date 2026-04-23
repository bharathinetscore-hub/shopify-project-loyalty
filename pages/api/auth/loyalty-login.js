import pool from "../../../db/db";
import { ensureLoyaltyUserTableSchema, findLoyaltyUserByIdentity } from "../../../lib/loyalty-user-table";

function cleanText(value) {
  return String(value || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    await ensureLoyaltyUserTableSchema(pool);

    const licenseKey = cleanText(req.body?.licenseKey);
    const productCode = cleanText(req.body?.productCode);

    if (!licenseKey || !productCode) {
      return res.status(400).json({
        success: false,
        message: "License key and product code are required",
      });
    }

    const existingUser = await findLoyaltyUserByIdentity(pool, {
      licenseKey,
      productCode,
      includeInactive: true,
    });

    if (!existingUser) {
      return res.status(401).json({
        success: false,
        message: "Loyalty user not found",
      });
    }

    const licenseExpired = new Date() > new Date(existingUser.plan_end_date);

    return res.status(200).json({
      success: true,
      message: licenseExpired ? "License expired. Please renew it as soon as possible." : "Login successful",
      user: {
        type: "loyalty",
        licenseKey: existingUser.license_key,
        productCode: existingUser.product_code,
        licenseUrl: existingUser.license_url,
        planEnd: existingUser.plan_end_date,
        licenseExpired,
      },
    });
  } catch (error) {
    console.error("Loyalty Login Error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Server error",
    });
  }
}
