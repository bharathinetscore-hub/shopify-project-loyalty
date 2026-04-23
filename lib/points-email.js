import nodemailer from "nodemailer";
import pool from "../db/db";
import { EMAIL_TEMPLATE_KEYS, resolveEmailTemplate } from "./email-templates";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatPoints(value) {
  return toNumber(value, 0).toFixed(2);
}

function formatAmountLine(value) {
  const amount = toNumber(value, 0);
  return amount > 0 ? `Amount: $${amount.toFixed(2)}` : "";
}

function formatCommentsLine(value) {
  const comments = cleanText(value);
  return comments ? `Comments: ${comments}` : "";
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

async function getLatestUserType() {
  const loyaltyRes = await pool.query(`
    SELECT updated_at
    FROM "netst-lmp-users"
    WHERE COALESCE(plan_active, true) = true
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  const netsuiteRes = await pool.query(`
    SELECT updated_at
    FROM "netst-lmp-netsuite-users"
    WHERE COALESCE(plan_active, true) = true
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  const loyaltyAt = loyaltyRes.rows[0]?.updated_at ? new Date(loyaltyRes.rows[0].updated_at).getTime() : 0;
  const netsuiteAt = netsuiteRes.rows[0]?.updated_at ? new Date(netsuiteRes.rows[0].updated_at).getTime() : 0;

  if (loyaltyAt <= 0 && netsuiteAt <= 0) return "";
  return loyaltyAt >= netsuiteAt ? "loyalty" : "netsuite";
}

export async function shouldSendLoyaltyPointsEmails() {
  const latestType = await getLatestUserType();
  return latestType === "loyalty";
}

export async function sendPointsNotificationEmail({
  templateKey,
  recipientEmail,
  customerName,
  eventName,
  points,
  availablePoints,
  amount = 0,
  comments = "",
}) {
  const email = cleanText(recipientEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { sent: false, skipped: true, error: "Recipient email is not valid" };
  }

  const shouldSend = await shouldSendLoyaltyPointsEmails();
  if (!shouldSend) {
    return { sent: false, skipped: true, error: "Points emails are disabled for NetSuite users" };
  }

  const config = getEmailTransportConfig();
  if (!config) {
    return {
      sent: false,
      skipped: true,
      error: "SMTP is not configured",
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

  const template = await resolveEmailTemplate(templateKey, {
    customerName: cleanText(customerName) || "Customer",
    eventName: cleanText(eventName) || "Loyalty activity",
    points: formatPoints(points),
    availablePoints: formatPoints(availablePoints),
    amountLine: formatAmountLine(amount),
    commentsLine: formatCommentsLine(comments),
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: email,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return { sent: true, skipped: false, error: "" };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: cleanText(error?.message) || "Failed to send points email",
    };
  }
}

export async function sendPointsEarnedEmail(payload) {
  return sendPointsNotificationEmail({
    ...payload,
    templateKey: EMAIL_TEMPLATE_KEYS.POINTS_EARNED,
  });
}

export async function sendPointsRedeemedEmail(payload) {
  return sendPointsNotificationEmail({
    ...payload,
    templateKey: EMAIL_TEMPLATE_KEYS.POINTS_REDEEMED,
  });
}
