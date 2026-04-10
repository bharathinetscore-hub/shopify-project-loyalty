function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

const { getShopAccessToken } = require("../../../lib/shopify-token-store");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  const q = String(req.query.q || "").trim();

  if (!shop) {
    return res.status(400).json({ error: "Missing or invalid shop parameter" });
  }

  const sessionToken = await getShopAccessToken(shop);
  const adminToken = sessionToken || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  const envShop = normalizeShopDomain(process.env.SHOPIFY_SHOP_DOMAIN || "");

  if (!adminToken) {
    return res.status(401).json({
      error: "No Shopify access token found. Re-authenticate once from app.",
    });
  }

  if (envShop && envShop !== shop) {
    return res.status(400).json({
      error: `Shop mismatch. Requested ${shop}, but SHOPIFY_SHOP_DOMAIN is ${envShop}`,
    });
  }

  try {
    const query = `
      query CustomerSearch($first: Int!, $query: String) {
        customers(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            firstName
            lastName
            email
          }
        }
      }
    `;

    const variables = {
      first: 100,
      query: q ? `name:*${q}* OR email:*${q}*` : "",
    };

    const shopifyRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await shopifyRes.json().catch(() => null);
    if (!shopifyRes.ok || !payload || payload.errors) {
      const firstError = payload?.errors?.[0]?.message || "";
      if (shopifyRes.status === 401 || /access token|unauthorized|invalid api key/i.test(firstError)) {
        return res.status(401).json({
          error: "Shopify access token is invalid or expired. Re-authenticate this store.",
        });
      }
      return res.status(502).json({
        error:
          firstError ||
          `Shopify Admin API failed with status ${shopifyRes.status}`,
      });
    }

    const customers = (payload?.data?.customers?.nodes || []).map((node) => {
      const gid = String(node?.id || "");
      const id = gid.split("/").pop() || "";
      const name = `${node?.firstName || ""} ${node?.lastName || ""}`.trim();
      return {
        id,
        name,
        email: String(node?.email || ""),
      };
    });

    return res.status(200).json({ customers });
  } catch (error) {
    console.error("get-customers error:", error);
    return res.status(500).json({ error: "Failed to load customers" });
  }
}
