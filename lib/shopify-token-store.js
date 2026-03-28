const pool = require("../db/db");

const KEY = "__lmp_shopify_tokens__";
const TABLE = "netst_shopify_tokens";

function getStore() {
  if (!global[KEY]) {
    global[KEY] = new Map();
  }
  return global[KEY];
}

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

let ensureTablePromise = null;
function ensureTokenTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id BIGSERIAL PRIMARY KEY,
        shop_domain TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  return ensureTablePromise;
}

async function setShopAccessToken(shop, accessToken) {
  const normalizedShop = normalizeShopDomain(shop);
  if (!normalizedShop || !accessToken) return;

  getStore().set(normalizedShop, accessToken);

  await ensureTokenTable();
  await pool.query(
    `
      INSERT INTO ${TABLE} (shop_domain, access_token)
      VALUES ($1, $2)
      ON CONFLICT (shop_domain)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        updated_at = CURRENT_TIMESTAMP
    `,
    [normalizedShop, String(accessToken)]
  );
}

async function getShopAccessToken(shop) {
  const normalizedShop = normalizeShopDomain(shop);
  if (!normalizedShop) return null;

  const fromMemory = getStore().get(normalizedShop);
  if (fromMemory) return fromMemory;

  await ensureTokenTable();
  const result = await pool.query(
    `
      SELECT access_token
      FROM ${TABLE}
      WHERE shop_domain = $1
      LIMIT 1
    `,
    [normalizedShop]
  );

  const fromDb = result.rows[0]?.access_token || null;
  if (fromDb) {
    getStore().set(normalizedShop, fromDb);
  }
  return fromDb;
}

module.exports = {
  setShopAccessToken,
  getShopAccessToken,
};
