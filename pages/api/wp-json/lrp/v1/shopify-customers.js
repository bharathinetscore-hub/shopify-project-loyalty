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

async function createCustomer(shop, accessToken, input) {
  const query = `
    mutation CreateCustomer($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
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
        userErrors {
          field
          message
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
      variables: { input },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function normalizeCustomerCreatePayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  const input = raw.customer && typeof raw.customer === "object" ? raw.customer : raw;

  return {
    firstName: cleanText(input.firstName ?? input.first_name),
    lastName: cleanText(input.lastName ?? input.last_name),
    email: cleanText(input.email),
    phone: cleanText(input.phone),
    tags: Array.isArray(input.tags)
      ? input.tags.map((tag) => cleanText(tag)).filter(Boolean)
      : cleanText(input.tags)
        ? cleanText(input.tags)
            .split(",")
            .map((tag) => cleanText(tag))
            .filter(Boolean)
        : [],
    note: cleanText(input.note),
    emailMarketingConsent: input.emailMarketingConsent ?? null,
    smsMarketingConsent: input.smsMarketingConsent ?? null,
  };
}

function buildCustomerInput(payload) {
  const input = {};

  if (payload.firstName) input.firstName = payload.firstName;
  if (payload.lastName) input.lastName = payload.lastName;
  if (payload.email) input.email = payload.email;
  if (payload.phone) input.phone = payload.phone;
  if (payload.tags.length) input.tags = payload.tags;
  if (payload.note) input.note = payload.note;
  if (payload.emailMarketingConsent) input.emailMarketingConsent = payload.emailMarketingConsent;
  if (payload.smsMarketingConsent) input.smsMarketingConsent = payload.smsMarketingConsent;

  return input;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
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
    if (req.method === "POST") {
      const payload = normalizeCustomerCreatePayload(req.body);
      const input = buildCustomerInput(payload);

      if (!input.email && !input.phone) {
        return res.status(400).json({
          success: false,
          error: "Send at least email or phone to create a Shopify customer.",
        });
      }

      const { response, payload: upstreamPayload } = await createCustomer(shop, accessToken, input);
      const userErrors = upstreamPayload?.data?.customerCreate?.userErrors || [];
      const createdCustomer = upstreamPayload?.data?.customerCreate?.customer || null;

      if (!response.ok || upstreamPayload?.errors?.length || userErrors.length) {
        return res.status(response.ok ? 422 : response.status).json({
          success: false,
          error:
            userErrors[0]?.message ||
            upstreamPayload?.errors?.[0]?.message ||
            upstreamPayload?.message ||
            "Failed to create Shopify customer",
          shop,
          upstreamStatus: response.status,
          details: upstreamPayload,
        });
      }

      return res.status(201).json({
        success: true,
        shop,
        customer: mapCustomer(createdCustomer),
      });
    }

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
