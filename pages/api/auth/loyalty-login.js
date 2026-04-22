import bcrypt from "bcrypt";
import LmpUser from "../../../models/LmpUser";
import pool from "../../../db/db";

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const { licenseKey, username, password } = req.body;

    if (!licenseKey || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, license key, and password are required",
      });
    }

    const user = await LmpUser.findByLogin(
      licenseKey,
      username
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Password is not configured for this user",
      });
    }

    let ok = false;

    if (isBcryptHash(user.password)) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = password === user.password;

      if (ok) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          `
          UPDATE "netst-lmp-users"
          SET password = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [hashedPassword, user.id]
        );
      }
    }

    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Wrong password",
      });
    }

    const licenseExpired = new Date() > new Date(user.plan_end_date);

    return res.status(200).json({
  success: true,
  message: licenseExpired ? "License expired. Please renew it as soon as possible." : "Login successful",
  user: {
    username: user.username,
    licenseKey: user.license_key,
    planEnd: user.plan_end_date,
    licenseExpired,
  },
});


  } catch (e) {
    console.error(e);
    res.status(500).json({
      success: false,
      message: e?.message || "Server error",
    });
  }
}
