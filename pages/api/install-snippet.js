const API_VERSION = "2024-01";

function normalizeAppBase() {
  const raw = process.env.SHOPIFY_APP_URL || process.env.HOST || "";
  return String(raw).replace(/\/+$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const { shop, accessToken } = JSON.parse(req.body);
    const appBase = normalizeAppBase();
    const correctSrc = `${appBase}/loader.js`;

    if (!appBase) {
      return res.status(500).json({
        success: false,
        error: "Missing SHOPIFY_APP_URL or HOST in server environment",
      });
    }

    const listRes = await fetch(`https://${shop}/admin/api/${API_VERSION}/script_tags.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    });
    const listData = await listRes.json();
    const tags = listData.script_tags || [];

    const loaderTags = tags.filter((s) => String(s?.src || "").includes("loader.js"));
    const wrongTags = loaderTags.filter(
      (s) => String(s?.src || "").replace(/\/+$/, "") !== correctSrc
    );
    const hasCorrect = loaderTags.some(
      (s) => String(s?.src || "").replace(/\/+$/, "") === correctSrc
    );

    if (hasCorrect && wrongTags.length === 0) {
      return res.json({ success: true, message: "Already installed", scriptSrc: correctSrc });
    }

    for (const tag of wrongTags) {
      const id = tag?.id;
      if (!id) continue;
      await fetch(`https://${shop}/admin/api/${API_VERSION}/script_tags/${id}.json`, {
        method: "DELETE",
        headers: {
          "X-Shopify-Access-Token": accessToken,
        },
      });
    }

    if (hasCorrect) {
      return res.json({
        success: true,
        message: "Removed stale loader.js script tag(s)",
        scriptSrc: correctSrc,
        removedStale: wrongTags.length,
      });
    }

    const installRes = await fetch(`https://${shop}/admin/api/${API_VERSION}/script_tags.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        script_tag: {
          event: "onload",
          src: correctSrc,
        },
      }),
    });

    const data = await installRes.json();

    if (!installRes.ok) {
      return res.status(installRes.status || 502).json({
        success: false,
        error: data?.errors || data?.error || "ScriptTag create failed",
        scriptSrc: correctSrc,
      });
    }

    console.log("✅ Script Installed:", data);

    return res.json({
      success: true,
      scriptSrc: correctSrc,
      removedStale: wrongTags.length,
    });
  } catch (err) {
    console.error("❌ Install Error:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
