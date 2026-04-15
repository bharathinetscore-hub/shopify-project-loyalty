/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/wp-json/lrp/v1/config",
        destination: "/api/wp-json/lrp/v1/config",
      },
      {
        source: "/wp-json/lrp/v1/customer",
        destination: "/api/wp-json/lrp/v1/customer",
      },
      {
        source: "/wp-json/lrp/v1/items",
        destination: "/api/wp-json/lrp/v1/items",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://admin.shopify.com https://*.myshopify.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
