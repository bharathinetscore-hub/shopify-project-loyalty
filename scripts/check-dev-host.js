function hasShopifyCliHost(env = process.env) {
  return Boolean(env.HOST || env.APP_URL);
}

function ensureShopifyCliHost(env = process.env) {
  if (env.NODE_ENV === "production") {
    return;
  }

  if (hasShopifyCliHost(env)) {
    return;
  }

  console.error(
    "Run: shopify app dev\n\n" +
      "Do not run `npm run dev` by itself - the Shopify CLI injects HOST (tunnel URL)."
  );
  process.exit(1);
}

if (require.main === module) {
  ensureShopifyCliHost();
}

module.exports = {
  ensureShopifyCliHost,
  hasShopifyCliHost,
};
