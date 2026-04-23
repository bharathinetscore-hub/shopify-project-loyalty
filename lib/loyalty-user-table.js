import pool from "../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

export async function ensureLoyaltyUserTableSchema(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "netst-lmp-users" (
      id BIGSERIAL PRIMARY KEY,
      license_key VARCHAR(255) NOT NULL,
      username VARCHAR(255) NULL,
      password VARCHAR(255) NULL,
      product_code VARCHAR(255) NULL,
      license_url VARCHAR(500) NULL,
      plan_start_date TIMESTAMPTZ NOT NULL,
      plan_end_date TIMESTAMPTZ NOT NULL,
      plan_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE "netst-lmp-users"
    ADD COLUMN IF NOT EXISTS product_code VARCHAR(255)
  `);

  await db.query(`
    ALTER TABLE "netst-lmp-users"
    ADD COLUMN IF NOT EXISTS license_url VARCHAR(500)
  `);

  await db.query(`
    ALTER TABLE "netst-lmp-users"
    ALTER COLUMN username DROP NOT NULL,
    ALTER COLUMN password DROP NOT NULL
  `);
}

export async function findLoyaltyUserByIdentity(
  db = pool,
  { licenseKey, productCode, username, includeInactive = true } = {}
) {
  const safeLicenseKey = cleanText(licenseKey);
  const safeProductCode = cleanText(productCode);
  const safeUsername = cleanText(username);

  if (!safeLicenseKey) {
    return null;
  }

  const clauses = [`license_key = $1`];
  const values = [safeLicenseKey];
  let nextIndex = values.length + 1;

  if (safeProductCode) {
    clauses.push(`product_code = $${nextIndex}`);
    values.push(safeProductCode);
    nextIndex += 1;
  } else if (safeUsername) {
    clauses.push(`username = $${nextIndex}`);
    values.push(safeUsername);
    nextIndex += 1;
  }

  if (!includeInactive) {
    clauses.push(`plan_active = true`);
  }

  const result = await db.query(
    `
      SELECT *
      FROM "netst-lmp-users"
      WHERE ${clauses.join(" AND ")}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 1
    `,
    values
  );

  return result.rows[0] || null;
}
