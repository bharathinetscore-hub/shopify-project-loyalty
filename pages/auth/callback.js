const { setShopAccessToken } = require("../../lib/shopify-token-store");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

export async function getServerSideProps(context) {
  const shop = normalizeShopDomain(context.query.shop);
  const code = context.query.code ? String(context.query.code) : "";
  const host = context.query.host ? String(context.query.host) : "";

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET_KEY;
  const forwardedHost =
    context.req.headers["x-shopify-forwarded-host"] ||
    context.req.headers["x-forwarded-host"] ||
    context.req.headers.host ||
    "";
  const proto = context.req.headers["x-forwarded-proto"] || "https";
  const appHost = (
    process.env.SHOPIFY_APP_URL ||
    process.env.HOST ||
    (forwardedHost ? `${proto}://${forwardedHost}` : "")
  ).replace(/\/+$/, "");

  if (!shop || !code || !apiKey || !apiSecret || !appHost) {
    return { notFound: true };
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
      return { notFound: true };
    }

    await setShopAccessToken(shop, payload.access_token);
    await fetch(
      `${appHost}/api/auth/ensure-storefront-loader?shop=${encodeURIComponent(shop)}`
    ).catch(() => null);
    await fetch(
      `${appHost}/api/auth/ensure-product-page-points?shop=${encodeURIComponent(shop)}`
    ).catch(() => null);

    const params = new URLSearchParams({ shop });
    if (host) {
      params.set("host", host);
    }

    return {
      redirect: {
        destination: `${appHost}/loyalty-config?${params.toString()}`,
        permanent: false,
      },
    };
  } catch {
    return { notFound: true };
  }
}

export default function AuthCallbackPage() {
  return null;
}
