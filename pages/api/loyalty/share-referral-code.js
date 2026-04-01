import cors from "../../../lib/cors";
import nodemailer from "nodemailer";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
    const receiverEmail = cleanText(req.body?.receiverEmail);
    const referralCode = cleanText(req.body?.referralCode);
    const customerName = cleanText(req.body?.customerName);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
      return res.status(400).json({ success: false, message: "Enter a valid receiver email." });
    }

    if (!referralCode) {
      return res.status(400).json({ success: false, message: "Referral code is not available." });
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
