import pool from "../../../db/db";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {

    const {
      authCode,
      licenseKey,
      productCode,
      accountId,
      licenseUrl,
    } = req.body;

    /* --------------------------
       1️⃣ Validate Input
    --------------------------- */

    if (
      !authCode ||
      !licenseKey ||
      !productCode ||
      !accountId ||
      !licenseUrl
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }

    /* --------------------------
       2️⃣ Call License Server (best effort)
    --------------------------- */
    let apiData = null;
    let licenseFetchFailed = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const apiRes = await fetch(licenseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${authCode}`,
        },
        body: JSON.stringify({
          licenseCode: licenseKey,
          productCode,
          accountId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const raw = await apiRes.text();
      console.log("RAW LICENSE RESPONSE:", raw);

      try {
        apiData = JSON.parse(raw);
      } catch {
        apiData = null;
      }

      if (!apiRes.ok || !apiData) {
        licenseFetchFailed = true;
      }
    } catch (fetchErr) {
      console.error("NetSuite license fetch error:", fetchErr);
      licenseFetchFailed = true;
    }

    /* --------------------------
       4️⃣ Extract Expiry
       (Adjust if field differs)
    --------------------------- */

    const isActiveFromApi = apiData?.Status === "Active";
    const planEndFromApi = apiData?.ExtendedExpiryDate || apiData?.ExpiredDate || null;
    const planStartFromApi = apiData?.planStartDate || new Date();

    /* --------------------------
       5️⃣ Check Existing User
    --------------------------- */

    const existing = await pool.query(
      `
      SELECT * FROM "netst-lmp-netsuite-users"
      WHERE license_key = $1
      `,
      [licenseKey]
    );

    let user;

    /* --------------------------
       6️⃣ Insert / Update
    --------------------------- */

    if (existing.rows.length === 0) {
      if (licenseFetchFailed || !planEndFromApi) {
        return res.status(401).json({
          success: false,
          message: "Unable to validate NetSuite license right now",
        });
      }

      const insert = await pool.query(
        `
        INSERT INTO "netst-lmp-netsuite-users"
        (
          license_key,
          product_code,
          account_id,
          license_url,
          plan_start_date,
          plan_end_date,
          plan_active,
          created_at,
          updated_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
        RETURNING *
        `,
        [
          licenseKey,
          productCode,
          accountId,
          licenseUrl,
          planStartFromApi,
          planEndFromApi,
          isActiveFromApi,
        ]
      );

      user = insert.rows[0];

    } else {
      if (licenseFetchFailed || !planEndFromApi) {
        user = existing.rows[0];
      } else {
        const update = await pool.query(
          `
          UPDATE "netst-lmp-netsuite-users"
          SET
            product_code = $2,
            account_id = $3,
            license_url = $4,
            plan_start_date = $5,
            plan_end_date = $6,
            plan_active = $7,
            updated_at = NOW()
          WHERE license_key = $1
          RETURNING *
          `,
          [
            licenseKey,
            productCode,
            accountId,
            licenseUrl,
            planStartFromApi,
            planEndFromApi,
            isActiveFromApi,
          ]
        );

        user = update.rows[0];
      }
    }

    /* --------------------------
       7️⃣ Expiry Check
    --------------------------- */

    const licenseExpired = new Date() > new Date(user.plan_end_date);

    /* --------------------------
       8️⃣ Success
    --------------------------- */

    return res.status(200).json({
      success: true,
      message: licenseExpired ? "License expired. Please renew it as soon as possible." : "Login successful",

      user: {
        type: "netsuite",
        licenseKey: user.license_key,
        productCode: user.product_code,
        accountId: user.account_id,
        licenseUrl: user.license_url,
        authCode: authCode, // ✅ ADD THIS
        planEnd: user.plan_end_date,
        licenseExpired,
      },
    });

  } catch (err) {

    console.error("NetSuite Login Error:", err);

    return res.status(500).json({
      success: false,
      message: err?.message || "Server error",
    });
  }
}
