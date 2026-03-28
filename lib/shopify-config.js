const DEFAULT_SCOPES = "read_products,read_product_listings,read_customers";

function getShopifyScopes() {
  const rawScopes = process.env.SCOPES || process.env.SHOPIFY_SCOPES || DEFAULT_SCOPES;

  return String(rawScopes)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(",");
}

module.exports = {
  getShopifyScopes,
};
