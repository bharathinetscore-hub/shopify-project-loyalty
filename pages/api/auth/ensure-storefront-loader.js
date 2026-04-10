const { getShopAccessToken } = require("../../../lib/shopify-token-store");

function normalizeShopDomain(rawShop) {
  if (!rawShop) return "";
  const shop = String(rawShop).trim().toLowerCase();
  const validShopPattern = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  return validShopPattern.test(shop) ? shop : "";
}

function resolveAppHost(req) {
  const forwardedHost =
    req.headers["x-shopify-forwarded-host"] ||
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    "";
  const proto = req.headers["x-forwarded-proto"] || "https";

  return String(
    process.env.SHOPIFY_APP_URL ||
      process.env.HOST ||
      (forwardedHost ? `${proto}://${forwardedHost}` : "")
  ).replace(/\/+$/, "");
}

/**
 * Ensures the storefront loader script tag is installed.
 * @returns {Promise<{ created: boolean, skipped?: boolean, reason?: string }>}
 *   - created: true if a new script tag was created
 *   - skipped: true if we did not run (e.g. missing scope)
 *   - reason: short reason when skipped
 */
async function ensureStorefrontScriptTag(shop, accessToken, appHost) {
  const apiVersion = "2024-01";
  const scriptSrc = `${appHost}/loader.js`;

  const checkRes = await fetch(`https://${shop}/admin/api/${apiVersion}/script_tags.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  const checkBody = await checkRes.text().catch(() => "");
  const checkData = (() => {
    try {
      return JSON.parse(checkBody || "{}");
    } catch (err) {
      return {};
    }
  })();

  if (!checkRes.ok) {
    if (checkRes.status === 403) {
      return { created: false, skipped: true, reason: "read_script_tags scope not granted" };
    }
    throw new Error(`Unable to read ScriptTags (${checkRes.status}): ${checkBody || "no response body"}`);
  }

  const existingTags = (checkData.script_tags || []).map((tag) => ({
    id: tag?.id || null,
    src: String(tag?.src || ""),
    event: String(tag?.event || ""),
  }));

  const loaderTags = existingTags.filter((tag) =>
    String(tag?.src || "").toLowerCase().includes("/loader.js")
  );
  const staleLoaderTags = loaderTags.filter(
    (tag) => String(tag?.src || "").replace(/\/+$/, "") !== scriptSrc
  );

  for (const tag of staleLoaderTags) {
    if (!tag?.id) continue;

    const deleteRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/script_tags/${tag.id}.json`,
      {
        method: "DELETE",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          Accept: "application/json",
        },
      }
    );

    if (!deleteRes.ok && deleteRes.status !== 404) {
      const deleteBody = await deleteRes.text().catch(() => "");
      throw new Error(
        `Unable to delete stale ScriptTag ${tag.id} (${deleteRes.status}): ${deleteBody || "no response body"}`
      );
    }
  }

  const remainingTags = existingTags.filter(
    (tag) => !staleLoaderTags.some((staleTag) => staleTag.id === tag.id)
  );

  const alreadyInstalled = remainingTags.some(
    (tag) => String(tag?.src || "").replace(/\/+$/, "") === scriptSrc
  );
  if (alreadyInstalled) {
    return {
      created: false,
      alreadyInstalled: true,
      existingTags: remainingTags,
      removedStaleTags: staleLoaderTags,
      scriptSrc,
    };
  }

  const createRes = await fetch(`https://${shop}/admin/api/${apiVersion}/script_tags.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
    body: JSON.stringify({
      script_tag: {
        event: "onload",
        src: scriptSrc,
      },
    }),
  });

  if (!createRes.ok) {
    if (createRes.status === 403) {
      return { created: false, skipped: true, reason: "write_script_tags scope not granted" };
    }
    const createData = await createRes.json().catch(() => ({}));
    throw new Error(`Unable to create ScriptTag (${createRes.status}): ${JSON.stringify(createData)}`);
  }

  const createData = await createRes.json().catch(() => ({}));
  return {
    created: true,
    alreadyInstalled: false,
    existingTags: remainingTags,
    removedStaleTags: staleLoaderTags,
    scriptSrc,
    createdTagId: createData?.script_tag?.id || null,
  };
}

/**
 * Ensures orders/updated webhook exists. Requires read_orders (or similar) scope.
 * @returns {Promise<{ created: boolean, skipped?: boolean, reason?: string }>}
 */
async function ensureOrdersUpdatedWebhook(shop, accessToken, appHost) {
  const apiVersion = "2024-01";
  const webhookAddress = `${appHost}/api/webhooks/orders-create`;

  const listRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  const listData = await listRes.json().catch(() => ({}));
  if (!listRes.ok) {
    throw new Error(`Unable to read webhooks (${listRes.status})`);
  }

  const exists = (listData.webhooks || []).some((webhook) => {
    const topic = String(webhook?.topic || "").toLowerCase();
    const address = String(webhook?.address || "").replace(/\/+$/, "");
    return topic === "orders/updated" && address === webhookAddress;
  });
  if (exists) return { created: false };

  const createRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
    body: JSON.stringify({
      webhook: {
        topic: "orders/updated",
        address: webhookAddress,
        format: "json",
      },
    }),
  });
  if (!createRes.ok) {
    const createData = await createRes.json().catch(() => ({}));
    if (createRes.status === 422) {
      const topicErr = createData?.errors?.topic?.[0] || "";
      return {
        created: false,
        skipped: true,
        reason: topicErr.includes("Invalid topic") ? "orders scope not granted" : topicErr || "webhook not allowed",
      };
    }
    throw new Error(`Unable to create orders/updated webhook (${createRes.status}): ${JSON.stringify(createData)}`);
  }
  return { created: true };
}

async function ensureCustomersUpdatedWebhook(shop, accessToken, appHost) {
  const apiVersion = "2024-01";
  const webhookAddress = `${appHost}/api/webhooks/customers-update`;

  const listRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
  });
  const listData = await listRes.json().catch(() => ({}));
  if (!listRes.ok) {
    throw new Error(`Unable to read webhooks (${listRes.status})`);
  }

  const exists = (listData.webhooks || []).some((webhook) => {
    const topic = String(webhook?.topic || "").toLowerCase();
    const address = String(webhook?.address || "").replace(/\/+$/, "");
    return topic === "customers/update" && address === webhookAddress;
  });
  if (exists) return { created: false };

  const createRes = await fetch(`https://${shop}/admin/api/${apiVersion}/webhooks.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      Accept: "application/json",
    },
    body: JSON.stringify({
      webhook: {
        topic: "customers/update",
        address: webhookAddress,
        format: "json",
      },
    }),
  });
  if (!createRes.ok) {
    const createData = await createRes.json().catch(() => ({}));
    if (createRes.status === 422) {
      const topicErr = createData?.errors?.topic?.[0] || "";
      return {
        created: false,
        skipped: true,
        reason: topicErr.includes("Invalid topic") ? "customers scope not granted" : topicErr || "webhook not allowed",
      };
    }
    throw new Error(`Unable to create customers/update webhook (${createRes.status}): ${JSON.stringify(createData)}`);
  }
  return { created: true };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const shop = normalizeShopDomain(req.query.shop);
  const appHost = resolveAppHost(req);
  if (!shop) {
    return res.status(400).json({ success: false, message: "Missing or invalid shop" });
  }
  if (!appHost) {
    return res.status(500).json({
      success: false,
      message: "Unable to resolve app host",
      debug: {
        envShopifyAppUrl: process.env.SHOPIFY_APP_URL || "",
        envHost: process.env.HOST || "",
        forwardedHost:
          req.headers["x-shopify-forwarded-host"] ||
          req.headers["x-forwarded-host"] ||
          req.headers.host ||
          "",
        forwardedProto: req.headers["x-forwarded-proto"] || "",
      },
    });
  }

  try {
    const accessToken = await getShopAccessToken(shop);
    if (!accessToken) {
      return res.status(404).json({
        success: false,
        message: "Shop token not found. Reauthorize app once from Shopify admin.",
      });
    }

    const scriptTagResult = await ensureStorefrontScriptTag(shop, accessToken, appHost);
    const scriptTagCreated = scriptTagResult.created === true;
    if (scriptTagResult.skipped && scriptTagResult.reason) {
      console.warn("ensure-storefront-loader: script tag skipped —", scriptTagResult.reason);
    }

    const webhookResult = await ensureOrdersUpdatedWebhook(shop, accessToken, appHost).catch((error) => ({
      created: false,
      skipped: true,
      reason: String(error?.message || error),
    }));
    const webhookCreated = webhookResult.created === true;
    if (webhookResult.skipped && webhookResult.reason) {
      console.warn("ensure-storefront-loader: orders webhook skipped —", webhookResult.reason);
    }

    const customerWebhookResult = await ensureCustomersUpdatedWebhook(shop, accessToken, appHost).catch((error) => ({
      created: false,
      skipped: true,
      reason: String(error?.message || error),
    }));
    const customerWebhookCreated = customerWebhookResult.created === true;
    if (customerWebhookResult.skipped && customerWebhookResult.reason) {
      console.warn("ensure-storefront-loader: customers webhook skipped â€”", customerWebhookResult.reason);
    }

    return res.status(200).json({
      success: true,
      shop,
      appHost,
      scriptTagCreated,
      scriptTagAlreadyInstalled: scriptTagResult.alreadyInstalled === true,
      scriptTagSkipped: scriptTagResult.skipped === true,
      scriptTagSkipReason: scriptTagResult.reason || null,
      scriptTagSrc: scriptTagResult.scriptSrc || `${appHost}/loader.js`,
      scriptTagCreatedTagId: scriptTagResult.createdTagId || null,
      existingScriptTags: scriptTagResult.existingTags || [],
      removedStaleScriptTags: scriptTagResult.removedStaleTags || [],
      webhookCreated,
      webhookSkipped: webhookResult.skipped === true,
      webhookSkipReason: webhookResult.reason || null,
      webhookError: webhookResult.reason || null,
      customerWebhookCreated,
      customerWebhookSkipped: customerWebhookResult.skipped === true,
      customerWebhookSkipReason: customerWebhookResult.reason || null,
      customerWebhookError: customerWebhookResult.reason || null,
    });
  } catch (error) {
    console.error("ensure-storefront-loader error:", error);
    return res.status(500).json({ success: false, message: "Failed to ensure storefront loader" });
  }
}
