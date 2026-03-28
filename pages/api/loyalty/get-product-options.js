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
  const searchText = String(req.query.q || "").trim();

  if (!shop) {
    return res.status(400).json({ error: "Missing or invalid shop parameter" });
  }

  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
  const envShop = normalizeShopDomain(process.env.SHOPIFY_SHOP_DOMAIN || "");

  if (!adminToken) {
    return res.status(500).json({
      error: "Missing SHOPIFY_ADMIN_ACCESS_TOKEN in .env",
    });
  }

  if (envShop && envShop !== shop) {
    return res.status(400).json({
      error: `Shop mismatch. Requested ${shop}, but SHOPIFY_SHOP_DOMAIN is ${envShop}`,
    });
  }

  try {
    const gqlQuery = `
      query ProductSearch($first: Int!, $query: String) {
        products(first: $first, sortKey: TITLE, query: $query) {
          nodes {
            id
            title
          }
        }
      }
    `;

    const variables = {
      first: 100,
      query: searchText ? `title:*${searchText}*` : "",
    };

    const shopifyRes = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({
        query: gqlQuery,
        variables,
      }),
    });

    const payload = await shopifyRes.json().catch(() => null);
    if (!shopifyRes.ok || !payload || payload.errors) {
      return res.status(502).json({
        error:
          payload?.errors?.[0]?.message ||
          `Shopify Admin API failed with status ${shopifyRes.status}`,
      });
    }

    const options = (payload?.data?.products?.nodes || []).map((product) => {
      const gid = String(product?.id || "");
      const id = gid.split("/").pop() || "";
      const name = String(product?.title || "");
      return {
        id,
        name,
        label: `${name || "Untitled Product"} (${id})`,
      };
    });

    return res.status(200).json({
      options,
      source: "admin_api_env_token",
      warning: options.length === 0 ? "No products matched your search." : "",
    });
  } catch (error) {
    console.error("get-product-options error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
