const { setShopAccessToken } = require("../../../lib/shopify-token-store");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

function resolveAppHost(req) {
  const forwardedHost =
    req.headers["x-shopify-forwarded-host"] ||
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    "";
  const proto = req.headers["x-forwarded-proto"] || "https";

  return String(
    process.env.SHOPIFY_APP_URL ||
      process.env.HOST ||
      (forwardedHost ? `${proto}://${forwardedHost}` : "")
  ).replace(/\/+$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  const code = req.query.code ? String(req.query.code) : "";
  const host = req.query.host ? String(req.query.host) : "";

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET_KEY;
  const appHost = resolveAppHost(req);

  if (!shop || !code) {
    return res.status(400).json({ success: false, message: "Missing shop or code" });
  }
  if (!apiKey || !apiSecret || !appHost) {
    return res.status(500).json({ success: false, message: "Missing OAuth env vars" });
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    const raw = await tokenRes.text();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    if (!tokenRes.ok || !payload.access_token) {
      return res.status(502).json({
        success: false,
        message: payload?.error_description || payload?.error || "Failed to exchange Shopify token",
      });
    }

    await setShopAccessToken(shop, payload.access_token);
    await fetch(
      `${appHost}/api/auth/ensure-storefront-loader?shop=${encodeURIComponent(shop)}`
    ).catch((error) => {
      console.error("ensure storefront loader after oauth failed:", error);
    });

    const backParams = new URLSearchParams({ shop });
    if (host) {
      backParams.set("host", host);
    }

    return res.redirect(`${appHost}/loyalty-config?${backParams.toString()}`);
  } catch (err) {
    console.error("shopify-callback error:", err);
    return res.status(500).json({ success: false, message: "OAuth callback failed" });
  }
}
