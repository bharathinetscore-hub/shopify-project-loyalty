const { getShopAccessToken } = require("../../../lib/shopify-token-store");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  if (!shop) {
    return res.status(400).json({ error: "Missing or invalid shop parameter" });
  }

  const accessToken = await getShopAccessToken(shop);
  if (!accessToken) {
    return res.status(401).json({ error: "No OAuth token found for shop. Re-authenticate app once." });
  }

  try {
    const scopeRes = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    });

    const payload = await scopeRes.json().catch(() => ({}));
    const scopes = (payload?.access_scopes || [])
      .map((entry) => entry.handle)
      .filter(Boolean);

    return res.status(scopeRes.ok ? 200 : 502).json({
      shop,
      hasReadProducts: scopes.includes("read_products"),
      scopes,
      upstreamStatus: scopeRes.status,
    });
  } catch (error) {
    return res.status(500).json({ error: "Scope check failed", details: error?.message || "Unknown error" });
  }
}
