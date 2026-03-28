import pool from "../../../db/db";
import cors from "../../../lib/cors";
import crypto from "crypto";
const { getShopAccessToken } = require("../../../lib/shopify-token-store");

const SHOPIFY_API_VERSION = "2026-01";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

async function ensureEventDetailsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customer__event_details_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL,
      date_created DATE DEFAULT NULL,
      event_name VARCHAR(255) DEFAULT NULL,
      points_earned NUMERIC(10,2) DEFAULT 0.00,
      points_redeemed NUMERIC(10,2) DEFAULT 0.00,
      points_left NUMERIC(10,2) DEFAULT 0.00,
      transaction_id BIGINT DEFAULT NULL,
      amount NUMERIC(10,2) DEFAULT 0.00,
      gift_code VARCHAR(100) DEFAULT NULL,
      receiver_email VARCHAR(255) DEFAULT NULL,
      refer_friend_id BIGINT DEFAULT NULL,
      comments TEXT DEFAULT NULL,
      points_expiration_date DATE DEFAULT NULL,
      points_expiration_days VARCHAR(255) DEFAULT NULL,
      expired BOOLEAN DEFAULT FALSE,
      points_type VARCHAR(10) DEFAULT 'positive',
      created_at TIMESTAMP DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT NULL,
      event_id INTEGER DEFAULT NULL
    )
  `);
}

async function loadGiftConfig() {
  const res = await pool.query(
    `
      SELECT
        minimum_redemption_points,
        each_point_value,
        loyalty_point_value,
        giftcard_expiry_days
      FROM netst_loyalty_config_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = res.rows[0] || {};
  return {
    minimumRedemptionPoints: toNumber(row.minimum_redemption_points, 0),
    eachPointValue: toNumber(row.each_point_value, 0),
    loyaltyPointValue: toNumber(row.loyalty_point_value, 0),
  };
}

async function loadAvailablePoints(customerId, customerEmail) {
  const res = await pool.query(
    `
      SELECT customer_id, receiver_email, points_earned, points_redeemed, points_type
      FROM netst_customer__event_details_table
      WHERE (
        ($1::text <> '' AND customer_id::text = $1)
        OR ($2::text <> '' AND LOWER(TRIM(COALESCE(receiver_email, ''))) = LOWER(TRIM($2)))
      )
    `,
    [customerId || "", customerEmail || ""]
  );

  const totals = res.rows.reduce(
    (acc, row) => {
      const type = cleanText(row.points_type).toLowerCase() || "positive";
      const earned = toNumber(row.points_earned, 0);
      const redeemed = toNumber(row.points_redeemed, 0);

      if (type === "negative") {
        acc.totalRedeemed += redeemed > 0 ? redeemed : Math.abs(earned);
      } else {
        acc.totalEarned += earned;
        acc.totalRedeemed += redeemed;
      }

      return acc;
    },
    { totalEarned: 0, totalRedeemed: 0 }
  );

  return {
    totalEarned: totals.totalEarned,
    totalRedeemed: totals.totalRedeemed,
    available: totals.totalEarned - totals.totalRedeemed,
  };
}

async function resolveShopToken(shopHint) {
  const hint = normalizeShopDomain(shopHint);
  if (hint) {
    const token = await getShopAccessToken(hint);
    if (token) return { shop: hint, token };
  }

  const envShop = normalizeShopDomain(process.env.SHOPIFY_SHOP_DOMAIN);
  if (envShop) {
    const token = await getShopAccessToken(envShop);
    if (token) return { shop: envShop, token };
  }

  const fallback = await pool.query(
    `
      SELECT shop_domain, access_token
      FROM netst_shopify_tokens
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `
  );

  const row = fallback.rows[0] || {};
  const shop = normalizeShopDomain(row.shop_domain);
  const token = cleanText(row.access_token);
  if (shop && token) return { shop, token };
  return { shop: "", token: "" };
}

function buildShortCheckoutExpiry() {
  const dt = new Date();
  dt.setMinutes(dt.getMinutes() + 20);
  return dt.toISOString();
}

async function createAutomaticCheckoutDiscount({ shop, token, customerId, title, amount }) {
  const startsAt = new Date().toISOString();
  const endsAt = buildShortCheckoutExpiry();

  const priceRuleRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/price_rules.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      price_rule: {
        title,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: `-${toNumber(amount, 0).toFixed(2)}`,
        customer_selection: "prerequisite",
        prerequisite_customer_ids: [toNumber(customerId, 0)],
        starts_at: startsAt,
        ends_at: endsAt,
        usage_limit: 1,
        once_per_customer: true,
      },
    }),
  });

  if (!priceRuleRes.ok) {
    const payload = await priceRuleRes.text();
    throw new Error(`Failed to create price rule (${priceRuleRes.status}): ${payload}`);
  }

  const priceRuleData = await priceRuleRes.json().catch(() => ({}));
  const priceRuleId = priceRuleData?.price_rule?.id;
  if (!priceRuleId) {
    throw new Error("Price rule created but id is missing");
  }

  return {
    id: priceRuleId,
    title,
    startsAt,
    endsAt,
  };
}

function generateDiscountCode(customerId) {
  const safeId = cleanText(customerId || "").replace(/\D+/g, "") || "guest";
  const randomSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `NSL-${safeId}-${randomSuffix}`;
}

async function createCheckoutDiscountCode({ shop, token, priceRuleId, customerId }) {
  const code = generateDiscountCode(customerId);
  const discountRes = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}/discount_codes.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        discount_code: {
          code,
        },
      }),
    }
  );

  const discountData = await discountRes.json().catch(() => ({}));
  if (!discountRes.ok || !discountData?.discount_code?.code) {
    throw new Error(
      `Failed to create checkout discount code (${discountRes.status}): ${JSON.stringify(
        discountData || {}
      )}`
    );
  }

  return {
    code: cleanText(discountData.discount_code.code),
    id: cleanText(discountData.discount_code.id),
  };
}

async function deletePriceRuleOnFailure(shop, token, priceRuleId) {
  if (!shop || !token || !priceRuleId) return;
  await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/price_rules/${priceRuleId}.json`, {
    method: "DELETE",
    headers: {
      "X-Shopify-Access-Token": token,
    },
  }).catch(() => null);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await ensureEventDetailsTable();

    const customerId = parseCustomerId(req.body?.customerId);
    const customerEmail = cleanText(req.body?.customerEmail);
    const redeemPoints = toNumber(req.body?.redeemPoints, NaN);
    const shopHint = cleanText(req.body?.shop);

    if (!customerId || !Number.isFinite(redeemPoints) || redeemPoints <= 0) {
      return res.status(400).json({ success: false, message: "Invalid request payload" });
    }

    const config = await loadGiftConfig();
    if (config.eachPointValue <= 0 || config.loyaltyPointValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Gift card conversion is not configured",
      });
    }

    const points = await loadAvailablePoints(customerId, customerEmail);
    const minimum = Math.max(0, config.minimumRedemptionPoints);
    if (minimum > 0 && points.available < minimum) {
      return res.status(400).json({
        success: false,
        message: `You need at least ${minimum.toFixed(2)} available points to use gift card`,
      });
    }

    if (redeemPoints > points.available) {
      return res.status(400).json({
        success: false,
        message: `Redeem points cannot exceed available points (${points.available.toFixed(2)})`,
      });
    }

    const amount = (redeemPoints / config.eachPointValue) * config.loyaltyPointValue;
    const { shop, token } = await resolveShopToken(shopHint);

    if (!shop || !token) {
      return res.status(400).json({
        success: false,
        message: "Shop token not found. Reinstall or reauthorize app.",
      });
    }

    const shopifyDiscount = await createAutomaticCheckoutDiscount({
      shop,
      token,
      customerId,
      title: "Loyalty points applied",
      amount,
    });

    let discountCodePayload;
    try {
      discountCodePayload = await createCheckoutDiscountCode({
        shop,
        token,
        priceRuleId: shopifyDiscount.id,
        customerId,
      });
    } catch (error) {
      await deletePriceRuleOnFailure(shop, token, shopifyDiscount.id);
      throw error;
    }

    return res.status(200).json({
      success: true,
      priceRuleId: String(shopifyDiscount.id),
      code: discountCodePayload.code,
      title: shopifyDiscount.title,
      amount,
      redeemPoints,
      expiryDate: shopifyDiscount.endsAt,
    });
  } catch (error) {
    console.error("create-checkout-loyalty-discount error:", error);
    const message = cleanText(error?.message);
    if (message.includes("write_price_rules")) {
      return res.status(403).json({
        success: false,
        message:
          "Missing Shopify scope write_price_rules. Reauthorize app and approve this scope, then try again.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create checkout loyalty discount",
    });
  }
}
