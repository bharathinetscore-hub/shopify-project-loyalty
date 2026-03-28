async function createProductMetafields(shop, accessToken) {

  const url = `https://${shop}/admin/api/2024-01/graphql.json`;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": accessToken,
  };

  // 🔹 GraphQL mutation to create definitions
  const query = `
  mutation CreateMetafieldDefinitions($definitions: [MetafieldDefinitionInput!]!) {
    metafieldDefinitionCreate(definitions: $definitions) {
      createdDefinitions {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
  `;

  const variables = {
    definitions: [

      // Checkbox 1
      {
        name: "Enable Loyalty Rewards",
        namespace: "loyalty",
        key: "enable_rewards",
        description: "Enable loyalty rewards for this product",
        type: "boolean",
        ownerType: "PRODUCT",
        pin: true
      },

      // Checkbox 2
      {
        name: "Enable Collection Type",
        namespace: "loyalty",
        key: "enable_collection",
        description: "Enable collection type",
        type: "boolean",
        ownerType: "PRODUCT",
        pin: true
      }

    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const data = await res.json();

  console.log("Metafield Result:", JSON.stringify(data, null, 2));

}

module.exports = {
  createProductMetafields,
};
