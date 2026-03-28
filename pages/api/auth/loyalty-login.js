import bcrypt from "bcrypt";
import LmpUser from "../../../models/LmpUser";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const { licenseKey, username, password } = req.body;

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

    const ok = await bcrypt.compare(password, user.password);

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
