import cors from "../../../lib/cors";
import nodemailer from "nodemailer";
import pool from "../../../db/db";

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
      SELECT loyalty_eligible, enable_refer_friend
      FROM netst_features_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = res.rows[0] || {};
  return {
    globalLoyaltyEnabled: Boolean(row.loyalty_eligible),
    referFriendEnabled: Boolean(row.enable_refer_friend),
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

async function sendReferralCodeEmail({ receiverEmail, customerName, referralCode }) {
  const config = getEmailTransportConfig();
  if (!config) {
    return {
      sent: false,
      error:
        "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM to enable referral emails.",
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

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: receiverEmail,
      subject: "Your referral code from NetScore Loyalty Rewards",
      text: [
        "Hello,",
        "",
        `${cleanText(customerName) || "A friend"} has shared a referral code with you.`,
        "",
        `Referral Code: ${referralCode}`,
        "",
        "Use this code during signup to enjoy loyalty rewards.",
        "",
        "Thank you!",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 16px; color: #1f2937;">
          <p>Hello,</p>
          <p><strong>${cleanText(customerName) || "A friend"}</strong> has shared a referral code with you.</p>
          <p><strong>Referral Code:</strong> ${referralCode}</p>
          <p>Use this code during signup to enjoy loyalty rewards.</p>
          <p>Thank you!</p>
        </div>
      `,
    });

    return { sent: true, error: "" };
  } catch (error) {
    return {
      sent: false,
      error: cleanText(error?.message) || "Failed to send referral email.",
    };
  }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const customerId = parseCustomerId(req.body?.customerId);
    const customerEmail = cleanText(req.body?.customerEmail);
    const receiverEmail = cleanText(req.body?.receiverEmail);
    const referralCode = cleanText(req.body?.referralCode);
    const customerName = cleanText(req.body?.customerName);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
      return res.status(400).json({ success: false, message: "Enter a valid receiver email." });
    }

    if (!referralCode) {
      return res.status(400).json({ success: false, message: "Referral code is not available." });
    }

    const features = await loadFeatureEligibility();
    const customerEligible = await loadCustomerEligibility(customerId, customerEmail);
    const canShareReferralCode =
      features.globalLoyaltyEnabled &&
      features.referFriendEnabled &&
      customerEligible;

    if (!canShareReferralCode) {
      return res.status(403).json({
        success: false,
        message: "This feature is disabled temporaryly.",
      });
    }

    const emailResult = await sendReferralCodeEmail({
      receiverEmail,
      customerName,
      referralCode,
    });

    return res.status(200).json({
      success: true,
      message: emailResult.sent
        ? `Referral code emailed to ${receiverEmail}.`
        : `Referral code created, but email could not be sent to ${receiverEmail}.`,
      receiverEmail,
      referralCode,
      emailSent: emailResult.sent,
      emailError: emailResult.error || "",
    });
  } catch (error) {
    console.error("share-referral-code error:", error);
    return res.status(500).json({ success: false, message: "Failed to share referral code" });
  }
}
