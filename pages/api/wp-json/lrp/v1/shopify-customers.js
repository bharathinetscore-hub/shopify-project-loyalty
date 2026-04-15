const { getShopAccessToken } = require("../../../../../lib/shopify-token-store");

const SHOPIFY_API_VERSION = "2026-01";

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeShopDomain(rawShop) {
  const shop = cleanText(rawShop).toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mapCustomer(node = {}) {
  return {
    id: cleanText(node.id),
    legacyResourceId: cleanText(node.legacyResourceId),
    firstName: cleanText(node.firstName),
    lastName: cleanText(node.lastName),
    displayName: cleanText(node.displayName),
    email: cleanText(node.email),
    phone: cleanText(node.phone),
    state: cleanText(node.state),
    createdAt: node.createdAt || null,
    updatedAt: node.updatedAt || null,
    numberOfOrders: Number(node.numberOfOrders || 0),
    amountSpent: node.amountSpent?.amount || null,
    amountSpentCurrency: node.amountSpent?.currencyCode || null,
    defaultAddress: node.defaultAddress
      ? {
          address1: cleanText(node.defaultAddress.address1),
          address2: cleanText(node.defaultAddress.address2),
          city: cleanText(node.defaultAddress.city),
          province: cleanText(node.defaultAddress.province),
          country: cleanText(node.defaultAddress.country),
          zip: cleanText(node.defaultAddress.zip),
        }
      : null,
  };
}

async function fetchCustomersPage(shop, accessToken, cursor, pageSize) {
  const query = `
    query GetCustomers($cursor: String, $pageSize: Int!) {
      customers(first: $pageSize, after: $cursor) {
        edges {
          cursor
          node {
            id
            legacyResourceId
            firstName
            lastName
            displayName
            email
            phone
            state
            createdAt
            updatedAt
            numberOfOrders
            amountSpent {
              amount
              currencyCode
            }
            defaultAddress {
              address1
              address2
              city
              province
              country
              zip
            }
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query,
      variables: {
        cursor,
        pageSize,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  if (!shop) {
    return res.status(400).json({
      success: false,
      error: "Missing or invalid shop parameter. Use shop=your-store.myshopify.com",
    });
  }

  const accessToken = await getShopAccessToken(shop);
  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: "No stored Shopify OAuth token found for this shop. Reinstall or re-auth the app once.",
    });
  }

  const pageSize = Math.min(toPositiveInt(req.query.limit, 50), 250);
  const fetchAll = cleanText(req.query.all).toLowerCase() === "true";

  try {
    const customers = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const { response, payload } = await fetchCustomersPage(shop, accessToken, cursor, pageSize);

      if (!response.ok || payload?.errors?.length) {
        return res.status(response.ok ? 502 : response.status).json({
          success: false,
          error:
            payload?.errors?.[0]?.message ||
            payload?.message ||
            "Failed to fetch customers from Shopify",
          shop,
          upstreamStatus: response.status,
          details: payload,
        });
      }

      const edges = payload?.data?.customers?.edges || [];
      customers.push(...edges.map((edge) => mapCustomer(edge?.node)));

      hasNextPage = Boolean(payload?.data?.customers?.pageInfo?.hasNextPage);
      cursor = edges.length ? edges[edges.length - 1].cursor : null;

      if (!fetchAll) break;
      if (!cursor) hasNextPage = false;
    }

    return res.status(200).json({
      success: true,
      shop,
      count: customers.length,
      pageSize,
      fetchedAll: fetchAll,
      customers,
    });
  } catch (error) {
    console.error("wp-json/lrp/v1/shopify-customers GET error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch Shopify customers",
      details: error?.message || "Unknown error",
    });
  }
}
