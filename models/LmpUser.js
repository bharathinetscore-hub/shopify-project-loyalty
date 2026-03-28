const pool = require("../db/db");

class LmpUser {

  static async findByLogin(licenseKey, username) {
    const res = await pool.query(
      `
      SELECT *
      FROM "netst-lmp-users"
      WHERE license_key = $1
        AND username = $2
        AND plan_active = true
      LIMIT 1
      `,
      [licenseKey, username]
    );

    return res.rows[0];
  }

}

module.exports = LmpUser;
