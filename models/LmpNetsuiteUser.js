const pool = require("../db/db");

class LmpNetsuiteUser {

  static async findByLicense(licenseKey, productCode) {
    const res = await pool.query(
      `
      SELECT *
      FROM "netst-lmp-netsuite-users"
      WHERE license_key = $1
        AND product_code = $2
        AND plan_active = true
      LIMIT 1
      `,
      [licenseKey, productCode]
    );

    return res.rows[0];
  }

}

module.exports = LmpNetsuiteUser;
