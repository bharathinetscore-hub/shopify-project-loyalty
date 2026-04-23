import pool from "../../../db/db";
import cors from "../../../lib/cors";
import nodemailer from "nodemailer";
import { EMAIL_TEMPLATE_KEYS, resolveEmailTemplate } from "../../../lib/email-templates";
import { sendPointsRedeemedEmail } from "../../../lib/points-email";
const { getShopAccessToken } = require("../../../lib/shopify-token-store");

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

function randomGiftCode() {
  return `GC-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
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

async function ensureFeaturesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_features_table (
      id SERIAL PRIMARY KEY,
      loyalty_eligible BOOLEAN DEFAULT FALSE,
      product_sharing_through_email BOOLEAN DEFAULT FALSE,
      enable_referral_code_use_at_signup BOOLEAN DEFAULT FALSE,
      login_to_see_points BOOLEAN DEFAULT FALSE,
      enable_redeem_history BOOLEAN DEFAULT FALSE,
      enable_refer_friend BOOLEAN DEFAULT FALSE,
      enable_gift_certificate_generation BOOLEAN DEFAULT FALSE,
      enable_tiers_info BOOLEAN DEFAULT FALSE,
      enable_profile_info BOOLEAN DEFAULT FALSE,
      enable_points_redeem_on_checkout BOOLEAN DEFAULT FALSE,
      my_account_tab_heading TEXT,
      loyalty_points_earned_label TEXT,
      redeem_history_label TEXT,
      refer_friend_label TEXT,
      gift_card_label TEXT,
      tiers_label TEXT,
      update_profile_label TEXT,
      product_redeem_label TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customers_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NULL,
      customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function loadFeatureEligibility() {
  await ensureFeaturesTable();

  const res = await pool.query(
    `
      SELECT loyalty_eligible, enable_gift_certificate_generation
      FROM netst_features_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = res.rows[0] || {};
  return {
    globalLoyaltyEnabled: Boolean(row.loyalty_eligible),
    giftCertificateGenerationEnabled: Boolean(row.enable_gift_certificate_generation),
  };
}

async function loadCustomerEligibility(customerId, customerEmail) {
  await ensureCustomersTable();

  const parsedCustomerId = parseCustomerId(customerId);
  if (parsedCustomerId) {
    const byId = await pool.query(
      `
        SELECT customer_eligible_for_loyalty
        FROM netst_customers_table
        WHERE (
          TRIM(COALESCE(customer_id, '')) = TRIM($1)
          OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
        )
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [parsedCustomerId]
    );

    if (byId.rows.length) {
      return Boolean(byId.rows[0]?.customer_eligible_for_loyalty);
    }
  }

  const normalizedEmail = cleanText(customerEmail);
  if (normalizedEmail) {
    const byEmail = await pool.query(
      `
        SELECT customer_eligible_for_loyalty
        FROM netst_customers_table
        WHERE LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($1))
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (byEmail.rows.length) {
      return Boolean(byEmail.rows[0]?.customer_eligible_for_loyalty);
    }
  }

  return false;
}

async function loadGiftConfig() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
      id SERIAL PRIMARY KEY,
      each_point_value NUMERIC(10,2) DEFAULT 1.00,
      loyalty_point_value NUMERIC(10,2) DEFAULT 1.00,
      minimum_redemption_points NUMERIC(10,2) DEFAULT 0.00,
      giftcard_expiry_days VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS giftcard_expiry_days VARCHAR(255) DEFAULT NULL
  `);

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
    giftcardExpiryDays: toNumber(row.giftcard_expiry_days, 0),
  };
}

async function loadGiftCardEventFromTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const eventRes = await pool.query(
    `
      SELECT event_id, event_name
      FROM netst_events_table
      WHERE event_id = '24'
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = eventRes.rows[0] || null;
  if (!row) return null;

  return {
    id: toNumber(row.event_id, 24),
    name: cleanText(row.event_name) || "Gift Card",
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

function buildExpiryTimestamp(expiryDays) {
  const days = Math.max(0, Math.floor(toNumber(expiryDays, 0)));
  if (!days) return null;
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
}

function getEmailTransportConfig() {
  const host = cleanText(process.env.SMTP_HOST);
  const port = toNumber(process.env.SMTP_PORT, 0);
  const user = cleanText(process.env.SMTP_USER);
  const pass = cleanText(process.env.SMTP_PASS);
  const fromEmail = cleanText(process.env.MAIL_FROM || user);
  const fromName = cleanText(process.env.MAIL_FROM_NAME || "NetScore Loyalty Rewards");

  if (!host || !port || !user || !pass || !fromEmail) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    fromEmail,
    fromName,
    secure: port === 465,
  };
}

async function sendGiftCardEmail({ receiverEmail, giftCode, giftAmount, expiryDate }) {
  const config = getEmailTransportConfig();
  if (!config) {
    return {
      sent: false,
      error:
        "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM to enable gift card emails.",
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const formattedAmount = `$${toNumber(giftAmount, 0).toFixed(2)}`;
  const template = await resolveEmailTemplate(EMAIL_TEMPLATE_KEYS.GIFT_CARD, {
    giftCode,
    giftAmount: formattedAmount,
    expiryDate: cleanText(expiryDate),
    expiryTextLine: expiryDate ? `Expires: ${cleanText(expiryDate)}` : "",
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: receiverEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return { sent: true, error: "" };
  } catch (error) {
    return {
      sent: false,
      error: cleanText(error?.message) || "Failed to send gift card email.",
    };
  }
}

async function createShopifyDiscountCode({ shop, token, code, amount, expiryDays }) {
  const apiVersion = "2026-01";
  const startsAt = new Date().toISOString();
  const endsAt = buildExpiryTimestamp(expiryDays);

  const priceRuleRes = await fetch(`https://${shop}/admin/api/${apiVersion}/price_rules.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      price_rule: {
        title: code,
        target_type: "line_item",
        target_selection: "all",
        allocation_method: "across",
        value_type: "fixed_amount",
        value: `-${toNumber(amount, 0).toFixed(2)}`,
        customer_selection: "all",
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

  const discountCodeRes = await fetch(
    `https://${shop}/admin/api/${apiVersion}/price_rules/${priceRuleId}/discount_codes.json`,
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

  if (!discountCodeRes.ok) {
    const payload = await discountCodeRes.text();
    throw new Error(`Failed to create discount code (${discountCodeRes.status}): ${payload}`);
  }

  const discountCodeData = await discountCodeRes.json().catch(() => ({}));
  return {
    priceRuleId,
    discountCodeId: discountCodeData?.discount_code?.id || null,
    code: discountCodeData?.discount_code?.code || code,
    startsAt,
    endsAt,
  };
}

async function loadAvailablePoints(customerId, customerEmail) {
  const res = await pool.query(
    `
      SELECT points_earned, points_redeemed, points_type
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

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await ensureEventDetailsTable();
    await ensureFeaturesTable();
    await ensureCustomersTable();

    const customerId = parseCustomerId(req.body?.customerId);
    const customerEmail = cleanText(req.body?.customerEmail);
    const receiverEmail = cleanText(req.body?.receiverEmail);
    const redeemPoints = toNumber(req.body?.redeemPoints, NaN);
    const shopHint = cleanText(req.body?.shop);

    if (!customerId || !Number.isFinite(redeemPoints) || redeemPoints <= 0) {
      return res.status(400).json({ success: false, message: "Invalid request payload" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
      return res.status(400).json({ success: false, message: "Invalid receiver email" });
    }

    const features = await loadFeatureEligibility();
    const customerEligible = await loadCustomerEligibility(customerId, customerEmail);
    const canGenerateGiftCard =
      features.globalLoyaltyEnabled &&
      features.giftCertificateGenerationEnabled &&
      customerEligible;

    if (!canGenerateGiftCard) {
      return res.status(403).json({
        success: false,
        message: "This feature is disabled temporaryly.",
      });
    }

    const config = await loadGiftConfig();
    const giftEvent = await loadGiftCardEventFromTable();
    if (!giftEvent) {
      return res.status(400).json({
        success: false,
        message: "Gift card event is missing in netst_events_table (event_id=24).",
      });
    }

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

    const giftAmount = (redeemPoints / config.eachPointValue) * config.loyaltyPointValue;
    const pointsLeft = points.available - redeemPoints;
    const giftCode = randomGiftCode();
    const { shop, token } = await resolveShopToken(shopHint);
    if (!shop || !token) {
      return res.status(400).json({
        success: false,
        message: "Shop token not found. Reinstall or reauthorize app.",
      });
    }

    const shopifyDiscount = await createShopifyDiscountCode({
      shop,
      token,
      code: giftCode,
      amount: giftAmount,
      expiryDays: config.giftcardExpiryDays,
    });

    const insertRes = await pool.query(
      `
        INSERT INTO netst_customer__event_details_table (
          customer_id,
          date_created,
          event_name,
          points_earned,
          points_redeemed,
          points_left,
          transaction_id,
          amount,
          gift_code,
          receiver_email,
          points_expiration_date,
          points_expiration_days,
          points_type,
          created_at,
          updated_at,
          event_id
        )
        VALUES (
          $1, CURRENT_DATE, $2, 0, $3, $4, NULL, $5, $6, $7, $8, $9, 'negative', NOW(), NOW(), $10
        )
        RETURNING id, date_created, event_name, points_redeemed, points_left, points_expiration_date, event_id
      `,
      [
        customerId,
        giftEvent.name,
        redeemPoints,
        pointsLeft,
        giftAmount,
        shopifyDiscount.code,
        receiverEmail,
        shopifyDiscount.endsAt ? shopifyDiscount.endsAt.slice(0, 10) : null,
        config.giftcardExpiryDays > 0 ? String(Math.floor(config.giftcardExpiryDays)) : null,
        giftEvent.id,
      ]
    );

    const emailResult = await sendGiftCardEmail({
      receiverEmail,
      giftCode: shopifyDiscount.code,
      giftAmount,
      expiryDate: shopifyDiscount.endsAt ? shopifyDiscount.endsAt.slice(0, 10) : null,
    });

    await sendPointsRedeemedEmail({
      recipientEmail: receiverEmail,
      customerName: cleanText(req.body?.customerName) || "Customer",
      eventName: giftEvent.name,
      points: redeemPoints,
      availablePoints: pointsLeft,
      amount: giftAmount,
      comments: "Gift card generated from loyalty points",
    }).catch((error) => console.error("redeem-gift-card points email error:", error));

    return res.status(200).json({
      success: true,
      message: emailResult.sent
        ? `Gift card generated and emailed to ${receiverEmail}.`
        : `Gift card generated, but email could not be sent to ${receiverEmail}. ${cleanText(emailResult.error) || ""}`.trim(),
      giftCode: shopifyDiscount.code,
      giftAmount,
      expiryDate: shopifyDiscount.endsAt,
      emailSent: emailResult.sent,
      emailError: emailResult.error || "",
      receiverEmail,
      row: insertRes.rows[0] || null,
      summary: {
        totalEarnedPoints: points.totalEarned,
        totalRedeemedPoints: points.totalRedeemed + redeemPoints,
        availablePoints: pointsLeft,
      },
    });
  } catch (error) {
    console.error("redeem-gift-card error:", error);
    const message = cleanText(error?.message);
    if (message.includes("write_price_rules")) {
      return res.status(403).json({
        success: false,
        message:
          "Missing Shopify scope write_price_rules. Reauthorize app and approve this scope, then try again.",
      });
    }
    return res.status(500).json({ success: false, message: "Failed to generate gift card" });
  }
}
