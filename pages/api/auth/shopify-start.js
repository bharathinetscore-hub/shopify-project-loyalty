const { getShopifyScopes } = require("../../../lib/shopify-config");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  const host = req.query.host ? String(req.query.host) : "";
  const appHost = (
    process.env.SHOPIFY_APP_URL ||
    process.env.HOST ||
    ""
  ).replace(/\/+$/, "");
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!shop) {
    return res.status(400).json({ success: false, message: "Missing or invalid shop parameter" });
  }
  if (!appHost || !apiKey) {
    return res.status(500).json({ success: false, message: "Missing HOST or SHOPIFY_API_KEY" });
  }

  const redirectUri = `${appHost}/api/auth/shopify-callback`;
  const scopes = getShopifyScopes();
  const state = `${Date.now()}`;

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  if (host) {
    params.set("host", host);
  }

  return res.redirect(`https://${shop}/admin/oauth/authorize?${params.toString()}`);
}
