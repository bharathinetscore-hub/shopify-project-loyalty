import pool from "../../../db/db";
import cors from "../../../lib/cors";
const { getShopAccessToken } = require("../../../lib/shopify-token-store");

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

async function resolveShopToken(shopHint) {
  const hint = normalizeShopDomain(shopHint);
  if (hint) {
    const token = await getShopAccessToken(hint);
    if (token) return { shop: hint, token };
  }

  const fallback = await pool.query(
    `
      SELECT shop_domain, access_token
      FROM netst_shopify_tokens
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `
  );

  const row = fallback.rows[0] || {};
  const shop = normalizeShopDomain(row.shop_domain);
  const token = cleanText(row.access_token);
  if (shop && token) return { shop, token };
  return { shop: "", token: "" };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const priceRuleId = cleanText(req.body?.priceRuleId);
    const shopHint = cleanText(req.body?.shop);

    if (!priceRuleId) {
      return res.status(400).json({ success: false, message: "Price rule id is required" });
    }

    const { shop, token } = await resolveShopToken(shopHint);
    if (!shop || !token) {
      return res.status(400).json({
        success: false,
        message: "Shop token not found. Reinstall or reauthorize app.",
      });
    }

    const apiVersion = "2026-01";
    const deleteRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/price_rules/${priceRuleId}.json`,
      {
        method: "DELETE",
        headers: {
          "X-Shopify-Access-Token": token,
        },
      }
    );

    if (!deleteRes.ok && deleteRes.status !== 404) {
      const payload = await deleteRes.text();
      return res.status(deleteRes.status).json({
        success: false,
        message: `Failed to delete loyalty discount: ${payload || deleteRes.status}`,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("delete-checkout-loyalty-discount error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete checkout loyalty discount",
    });
  }
}
