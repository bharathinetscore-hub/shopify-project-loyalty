export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {

    const { shop, accessToken } = JSON.parse(req.body);

    // 1. Check existing scripts
    const checkRes = await fetch(
      `https://${shop}/admin/api/2024-01/script_tags.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      }
    );

    const checkData = await checkRes.json();

    const alreadyInstalled = checkData.script_tags?.some(
      (s) => s.src.includes("loader.js")
    );

    if (alreadyInstalled) {
      return res.json({ success: true, message: "Already installed" });
    }

    // 2. Install Script
    const installRes = await fetch(
      `https://${shop}/admin/api/2024-01/script_tags.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          script_tag: {
            event: "onload",
            src: `${process.env.SHOPIFY_APP_URL || process.env.HOST}/loader.js`,
          },
        }),
      }
    );

    const data = await installRes.json();

    console.log("✅ Script Installed:", data);

    return res.json({ success: true });

  } catch (err) {

    console.error("❌ Install Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
