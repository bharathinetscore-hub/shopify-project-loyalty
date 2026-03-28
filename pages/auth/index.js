const { getShopifyScopes } = require("../../lib/shopify-config");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

export async function getServerSideProps(context) {
  const shop = normalizeShopDomain(context.query.shop);
  const host = context.query.host ? String(context.query.host) : "";
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
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!shop || !appHost || !apiKey) {
    return {
      notFound: true,
    };
  }

  const redirectUri = `${appHost}/auth/callback`;
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: getShopifyScopes(),
    redirect_uri: redirectUri,
    state: `${Date.now()}`,
  });
  if (host) {
    params.set("host", host);
  }

  return {
    redirect: {
      destination: `https://${shop}/admin/oauth/authorize?${params.toString()}`,
      permanent: false,
    },
  };
}

export default function AuthStartPage() {
  return null;
}
