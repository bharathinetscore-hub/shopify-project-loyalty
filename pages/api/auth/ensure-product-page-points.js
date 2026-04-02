const { getShopAccessToken } = require("../../../lib/shopify-token-store");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

function escapeScriptContent(value) {
  return String(value || "").replace(/<\//g, "<\\/");
}

function buildSnippetValue(appHost) {
  const safeHost = String(appHost || "").replace(/\/+$/, "");
  const script = `
<div id="netscore-loyalty-points-box" style="display:none;margin:12px 0;padding:12px 14px;border:1px solid #d6eadc;border-radius:12px;background:linear-gradient(180deg,#f3fff6 0%,#ecf8f0 100%);color:#166534;font-size:15px;font-weight:700;line-height:1.4;">
  Earn points
</div>
<script>
document.addEventListener("DOMContentLoaded", async function () {
  try {
    var box = document.getElementById("netscore-loyalty-points-box");
    if (!box) return;
    var productId = "{{ product.id }}";
    var form = document.querySelector("form[action*='/cart/add']");
    var variantId = form && form.querySelector("[name='id']") ? form.querySelector("[name='id']").value : "";
    var productPrice = 0;
    if (variantId && "{{ product.handle }}") {
      try {
        var productRes = await fetch("/products/{{ product.handle }}.js", { headers: { Accept: "application/json" } });
        var productData = await productRes.json();
        var variants = Array.isArray(productData && productData.variants) ? productData.variants : [];
        var variant = variants.find(function (item) { return String(item.id) === String(variantId); }) || variants[0];
        if (variant && !isNaN(Number(variant.price))) {
          productPrice = Number(variant.price) / 100;
        }
      } catch (err) {}
    }
    if (!productPrice) {
      var priceText = (document.querySelector(".price-item--regular") || document.querySelector(".price-item--sale"));
      var normalized = priceText ? Number(String(priceText.textContent || "").replace(/[^0-9.]/g, "")) : 0;
      if (!isNaN(normalized) && normalized > 0) productPrice = normalized;
    }
    if (!productId || !productPrice) return;
    var res = await fetch("${safeHost}/api/loyalty/get-product-reward-preview?productId=" + encodeURIComponent(productId) + "&productPrice=" + encodeURIComponent(productPrice), {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data || !data.eligible || !data.points) return;
    box.textContent = data.message || ("Earn " + data.points + " points with this purchase");
    box.style.display = "block";
  } catch (error) {
    console.error("NetScore Loyalty product points snippet failed:", error);
  }
});
</script>
`;

  return escapeScriptContent(script);
}

async function shopifyFetch(shop, accessToken, path, options = {}) {
  const apiVersion = "2024-01";
  return fetch(`https://${shop}/admin/api/${apiVersion}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...(options.headers || {}),
    },
  });
}

async function getMainTheme(shop, accessToken) {
  const res = await shopifyFetch(shop, accessToken, "/themes.json", { method: "GET" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) {
      return { theme: null, skipped: true, reason: "themes scope not granted" };
    }
    throw new Error(`Unable to load themes (${res.status})`);
  }

  const themes = Array.isArray(payload?.themes) ? payload.themes : [];
  const mainTheme =
    themes.find((theme) => String(theme?.role || "").toLowerCase() === "main") ||
    themes.find((theme) => String(theme?.role || "").toLowerCase() === "demo") ||
    themes[0] ||
    null;

  return { theme: mainTheme, skipped: false, reason: "" };
}

async function listAssets(shop, accessToken, themeId) {
  const res = await shopifyFetch(shop, accessToken, `/themes/${themeId}/assets.json`, { method: "GET" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) {
      return { assets: [], skipped: true, reason: "themes scope not granted" };
    }
    throw new Error(`Unable to list theme assets (${res.status})`);
  }
  return { assets: Array.isArray(payload?.assets) ? payload.assets : [], skipped: false, reason: "" };
}

async function getAssetValue(shop, accessToken, themeId, key) {
  const res = await shopifyFetch(
    shop,
    accessToken,
    `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
    { method: "GET" }
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Unable to read theme asset ${key} (${res.status})`);
  }
  return String(payload?.asset?.value || "");
}

async function saveAssetValue(shop, accessToken, themeId, key, value) {
  const res = await shopifyFetch(shop, accessToken, `/themes/${themeId}/assets.json`, {
    method: "PUT",
    body: JSON.stringify({
      asset: {
        key,
        value,
      },
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 403) {
      return { updated: false, skipped: true, reason: "themes scope not granted" };
    }
    throw new Error(`Unable to save theme asset ${key} (${res.status}): ${JSON.stringify(payload)}`);
  }

  return { updated: true, skipped: false, reason: "" };
}

async function ensureSnippetAsset(shop, accessToken, themeId, appHost) {
  return saveAssetValue(
    shop,
    accessToken,
    themeId,
    "snippets/netscore-loyalty-points.liquid",
    buildSnippetValue(appHost)
  );
}

async function ensureSnippetRenderedInProductSection(shop, accessToken, themeId) {
  const snippetTag = "{% render 'netscore-loyalty-points' %}";
  const candidateKeys = [
    "sections/main-product.liquid",
    "sections/featured-product.liquid",
    "sections/product-template.liquid",
    "snippets/buy-buttons.liquid",
  ];

  for (const key of candidateKeys) {
    let value = "";
    try {
      value = await getAssetValue(shop, accessToken, themeId, key);
    } catch {
      continue;
    }

    if (!value) continue;
    if (value.includes(snippetTag)) {
      return { updated: false, target: key, injected: true };
    }

    let nextValue = "";
    if (key === "snippets/buy-buttons.liquid") {
      nextValue = `${snippetTag}\n${value}`;
    } else if (value.includes("<product-form")) {
      nextValue = value.replace("<product-form", `${snippetTag}\n<product-form`);
    } else if (value.includes("product-form")) {
      nextValue = `${snippetTag}\n${value}`;
    } else {
      nextValue = `${snippetTag}\n${value}`;
    }

    await saveAssetValue(shop, accessToken, themeId, key, nextValue);
    return { updated: true, target: key, injected: true };
  }

  return { updated: false, target: "", injected: false };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  const appHost = (process.env.SHOPIFY_APP_URL || process.env.HOST || "").replace(/\/+$/, "");

  if (!shop) {
    return res.status(400).json({ success: false, message: "Missing or invalid shop" });
  }
  if (!appHost) {
    return res.status(500).json({ success: false, message: "Missing HOST env var" });
  }

  try {
    const accessToken = await getShopAccessToken(shop);
    if (!accessToken) {
      return res.status(404).json({
        success: false,
        message: "Shop token not found. Reauthorize app once from Shopify admin.",
      });
    }

    const themeLookup = await getMainTheme(shop, accessToken);
    if (themeLookup.skipped) {
      return res.status(200).json({
        success: false,
        skipped: true,
        reason: themeLookup.reason,
      });
    }

    const theme = themeLookup.theme;
    if (!theme?.id) {
      return res.status(404).json({ success: false, message: "No active theme found" });
    }

    const snippetResult = await ensureSnippetAsset(shop, accessToken, theme.id, appHost);
    if (snippetResult.skipped) {
      return res.status(200).json({
        success: false,
        skipped: true,
        reason: snippetResult.reason,
      });
    }

    const injectionResult = await ensureSnippetRenderedInProductSection(shop, accessToken, theme.id);

    return res.status(200).json({
      success: true,
      themeId: theme.id,
      themeName: theme.name || "",
      snippetCreated: snippetResult.updated,
      injectedIntoProductTemplate: injectionResult.injected,
      targetAsset: injectionResult.target || null,
    });
  } catch (error) {
    console.error("ensure-product-page-points error:", error);
    return res.status(500).json({ success: false, message: "Failed to ensure product page points" });
  }
}
