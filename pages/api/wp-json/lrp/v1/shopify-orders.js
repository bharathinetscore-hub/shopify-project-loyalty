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

function buildOrdersSearchQuery(query) {
  const parts = [];

  if (cleanText(query.status)) {
    parts.push(`status:${cleanText(query.status)}`);
  }

  if (cleanText(query.financialStatus)) {
    parts.push(`financial_status:${cleanText(query.financialStatus)}`);
  }

  if (cleanText(query.fulfillmentStatus)) {
    parts.push(`fulfillment_status:${cleanText(query.fulfillmentStatus)}`);
  }

  if (cleanText(query.createdAtMin)) {
    parts.push(`created_at:>=${cleanText(query.createdAtMin)}`);
  }

  if (cleanText(query.createdAtMax)) {
    parts.push(`created_at:<=${cleanText(query.createdAtMax)}`);
  }

  return parts.join(" ");
}

function mapLineItem(node = {}) {
  return {
    id: cleanText(node.id),
    name: cleanText(node.name),
    title: cleanText(node.title),
    sku: cleanText(node.sku),
    quantity: Number(node.quantity || 0),
    discountedTotal: node.discountedTotalSet?.shopMoney?.amount || null,
    discountedTotalCurrency: node.discountedTotalSet?.shopMoney?.currencyCode || null,
    originalTotal: node.originalTotalSet?.shopMoney?.amount || null,
    originalTotalCurrency: node.originalTotalSet?.shopMoney?.currencyCode || null,
    variantId: cleanText(node.variant?.id),
    productId: cleanText(node.product?.id),
  };
}

function mapOrder(node = {}) {
  return {
    id: cleanText(node.id),
    legacyResourceId: cleanText(node.legacyResourceId),
    name: cleanText(node.name),
    createdAt: node.createdAt || null,
    updatedAt: node.updatedAt || null,
    processedAt: node.processedAt || null,
    cancelledAt: node.cancelledAt || null,
    cancelReason: cleanText(node.cancelReason),
    displayFinancialStatus: cleanText(node.displayFinancialStatus),
    displayFulfillmentStatus: cleanText(node.displayFulfillmentStatus),
    currencyCode: cleanText(node.currencyCode),
    totalPrice: node.totalPriceSet?.shopMoney?.amount || null,
    totalPriceCurrency: node.totalPriceSet?.shopMoney?.currencyCode || null,
    subtotalPrice: node.subtotalPriceSet?.shopMoney?.amount || null,
    subtotalPriceCurrency: node.subtotalPriceSet?.shopMoney?.currencyCode || null,
    totalTax: node.totalTaxSet?.shopMoney?.amount || null,
    totalTaxCurrency: node.totalTaxSet?.shopMoney?.currencyCode || null,
    totalShipping: node.totalShippingPriceSet?.shopMoney?.amount || null,
    totalShippingCurrency: node.totalShippingPriceSet?.shopMoney?.currencyCode || null,
    customer: node.customer
      ? {
          id: cleanText(node.customer.id),
          firstName: cleanText(node.customer.firstName),
          lastName: cleanText(node.customer.lastName),
          displayName: cleanText(node.customer.displayName),
          email: cleanText(node.customer.email),
          phone: cleanText(node.customer.phone),
        }
      : null,
    shippingAddress: node.shippingAddress
      ? {
          name: cleanText(node.shippingAddress.name),
          address1: cleanText(node.shippingAddress.address1),
          address2: cleanText(node.shippingAddress.address2),
          city: cleanText(node.shippingAddress.city),
          province: cleanText(node.shippingAddress.province),
          country: cleanText(node.shippingAddress.country),
          zip: cleanText(node.shippingAddress.zip),
          phone: cleanText(node.shippingAddress.phone),
        }
      : null,
    billingAddress: node.billingAddress
      ? {
          name: cleanText(node.billingAddress.name),
          address1: cleanText(node.billingAddress.address1),
          address2: cleanText(node.billingAddress.address2),
          city: cleanText(node.billingAddress.city),
          province: cleanText(node.billingAddress.province),
          country: cleanText(node.billingAddress.country),
          zip: cleanText(node.billingAddress.zip),
          phone: cleanText(node.billingAddress.phone),
        }
      : null,
    lineItems: (node.lineItems?.nodes || []).map(mapLineItem),
  };
}

async function fetchOrdersPage(shop, accessToken, cursor, pageSize, searchQuery) {
  const query = `
    query GetOrders($cursor: String, $pageSize: Int!, $searchQuery: String) {
      orders(first: $pageSize, after: $cursor, sortKey: CREATED_AT, reverse: true, query: $searchQuery) {
        edges {
          cursor
          node {
            id
            legacyResourceId
            name
            createdAt
            updatedAt
            processedAt
            cancelledAt
            cancelReason
            displayFinancialStatus
            displayFulfillmentStatus
            currencyCode
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              id
              firstName
              lastName
              displayName
              email
              phone
            }
            shippingAddress {
              name
              address1
              address2
              city
              province
              country
              zip
              phone
            }
            billingAddress {
              name
              address1
              address2
              city
              province
              country
              zip
              phone
            }
            lineItems(first: 100) {
              nodes {
                id
                name
                title
                sku
                quantity
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                }
                product {
                  id
                }
              }
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
        searchQuery: searchQuery || null,
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
  const searchQuery = buildOrdersSearchQuery({
    status: req.query.status,
    financialStatus: req.query.financial_status,
    fulfillmentStatus: req.query.fulfillment_status,
    createdAtMin: req.query.created_at_min,
    createdAtMax: req.query.created_at_max,
  });

  try {
    const orders = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const { response, payload } = await fetchOrdersPage(
        shop,
        accessToken,
        cursor,
        pageSize,
        searchQuery
      );

      if (!response.ok || payload?.errors?.length) {
        return res.status(response.ok ? 502 : response.status).json({
          success: false,
          error:
            payload?.errors?.[0]?.message ||
            payload?.message ||
            "Failed to fetch orders from Shopify",
          shop,
          upstreamStatus: response.status,
          details: payload,
        });
      }

      const edges = payload?.data?.orders?.edges || [];
      orders.push(...edges.map((edge) => mapOrder(edge?.node)));

      hasNextPage = Boolean(payload?.data?.orders?.pageInfo?.hasNextPage);
      cursor = edges.length ? edges[edges.length - 1].cursor : null;

      if (!fetchAll) break;
      if (!cursor) hasNextPage = false;
    }

    return res.status(200).json({
      success: true,
      shop,
      count: orders.length,
      pageSize,
      fetchedAll: fetchAll,
      searchQuery,
      orders,
    });
  } catch (error) {
    console.error("wp-json/lrp/v1/shopify-orders GET error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch Shopify orders",
      details: error?.message || "Unknown error",
    });
  }
}
