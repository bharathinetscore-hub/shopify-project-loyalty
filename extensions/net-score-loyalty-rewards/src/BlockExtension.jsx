import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

// Prefer the live origin (handles whichever tunnel the iframe is loaded from).
function resolveApiBase() {
  const liveOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? String(window.location.origin)
      : "";

  if (/^https:\/\/([a-z0-9-]+\.)trycloudflare\.com$/i.test(liveOrigin)) {
    return liveOrigin.replace(/\/$/, "");
  }

  const envBase =
    (typeof process !== "undefined" &&
      (process.env?.SHOPIFY_APP_URL ||
        process.env?.APP_URL ||
        process.env?.HOST ||
        process.env?.API_BASE_URL)) ||
    (typeof window !== "undefined" && window.__SHOPIFY_APP_URL__);

  if (envBase) {
    return String(envBase).replace(/\/$/, "");
  }

  return "";
}
const API_BASE = resolveApiBase();

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const DEBUG = false;
  const APP_HANDLE = "netscore-loyalty-rewards";

  const [productId, setProductId] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (shopify?.data?.resource?.id) {
        setProductId(shopify.data.resource.id);
        clearInterval(interval);
      }

      if (shopify?.data?.selected?.[0]?.id) {
        setProductId(shopify.data.selected[0].id);
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, []);

  const [enableLoyalty, setEnableLoyalty] = useState(false);
  const [enableCollection, setEnableCollection] = useState(false);
  const [collectionType, setCollectionType] = useState("");
  const [pointsValue, setPointsValue] = useState("");
  const [skuMultiplier, setSkuMultiplier] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [licenseExpired, setLicenseExpired] = useState(true);
  const [licenseMessage, setLicenseMessage] = useState("Checking license status...");
  const [userMeta, setUserMeta] = useState(null);
  const [planEndFromApi, setPlanEndFromApi] = useState("");
  const [expiredFromApi, setExpiredFromApi] = useState("unknown");

  useEffect(() => {
    try {
      const raw =
        window?.sessionStorage?.getItem("lmpUser") ||
        window?.localStorage?.getItem("lmpUser");
      setUserMeta(raw ? JSON.parse(raw) : null);
    } catch {
      setUserMeta(null);
    }
  }, []);

  async function loadSettings() {
    if (!productId) return;
    if (!API_BASE) {
      setLicenseExpired(true);
      setLicenseMessage(
        "Missing app URL in dev preview. Restart `shopify app dev --reset` and clean the current dev preview."
      );
      setStatus("");
      return;
    }

    try {
      const params = new URLSearchParams({
        productId: String(productId),
        type: userMeta?.type || "",
        licenseKey: userMeta?.licenseKey || "",
        username: userMeta?.username || "",
        productCode: userMeta?.productCode || "",
      });
      const url = `${API_BASE}/api/loyalty/get-settings?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message =
          errorData?.message ||
          errorData?.error ||
          "License expired. Please renew it as soon as possible.";
        setLicenseExpired(true);
        setLicenseMessage(message);
        setPlanEndFromApi("");
        setExpiredFromApi("unknown");
        if (DEBUG) {
          setStatus(
            `DBG load error | session=${String(userMeta?.planEnd || "N/A")} | api=N/A | expired=unknown`
          );
        }
        return;
      }

      const data = await res.json().catch(() => null);

      if (!data) {
        setLicenseExpired(true);
        setLicenseMessage("License expired. Please renew it as soon as possible.");
        setPlanEndFromApi("");
        setExpiredFromApi("unknown");
        if (DEBUG) {
          setStatus(
            `DBG no data | session=${String(userMeta?.planEnd || "N/A")} | api=N/A | expired=unknown`
          );
        }
        return;
      }

      const apiSaysExpired = data.licenseExpired;
      if (typeof apiSaysExpired !== "boolean") {
        setLicenseExpired(true);
        setLicenseMessage("License expired. Please renew it as soon as possible.");
        setPlanEndFromApi(String(data?.planEnd || ""));
        setExpiredFromApi("unknown");
        if (DEBUG) {
          setStatus(
            `DBG invalid expired flag | session=${String(userMeta?.planEnd || "N/A")} | api=${String(
              data?.planEnd || "N/A"
            )} | expired=unknown`
          );
        }
        return;
      }

      setLicenseExpired(apiSaysExpired);
      setLicenseMessage(
        data.licenseMessage ||
          (apiSaysExpired ? "License expired. Please renew it as soon as possible." : "")
      );
      setPlanEndFromApi(String(data?.planEnd || ""));
      setExpiredFromApi(String(apiSaysExpired));
      if (DEBUG) {
        setStatus(
          `DBG ok | session=${String(userMeta?.planEnd || "N/A")} | api=${String(
            data?.planEnd || "N/A"
          )} | expired=${String(apiSaysExpired)}`
        );
      }

      if (apiSaysExpired) return;

      setEnableLoyalty(!!data.is_eligible_for_loyalty_program);
      setEnableCollection(!!data.enable_collection_type);
      setCollectionType(data.collection_type || "");
      setPointsValue(data.points_based_points || "");
      setSkuMultiplier(data.sku_based_points || "");
    } catch (err) {
      console.error("Load error:", err);
    }
  }

  useEffect(() => {
    if (productId) {
      console.log("Using Product ID:", productId);
      loadSettings();
    }
  }, [productId, userMeta]);

  async function save() {
    if (!productId) return;
    if (!API_BASE) {
      setStatus("Missing app URL in dev preview. Restart `shopify app dev --reset`.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/loyalty/save-settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          productId,
          enableLoyalty,
          enableCollection,
          collectionType,
          pointsValue,
          skuMultiplier,
          type: userMeta?.type || "",
          licenseKey: userMeta?.licenseKey || "",
          username: userMeta?.username || "",
          productCode: userMeta?.productCode || "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || data?.message || "Save failed";
        if (res.status === 403) {
          setLicenseExpired(true);
          setLicenseMessage(msg);
        }
        throw new Error(msg);
      }

      setStatus(`Saved (item_id: ${data?.itemId || "ok"})`);
      await loadSettings();
    } catch (err) {
      console.error("Save error:", err);
      setStatus("Failed to save");
    } finally {
      setLoading(false);
    }
  }

  function getStorePrefixFromPath() {
    try {
      const path = window?.top?.location?.pathname || "";
      const match = path.match(/^\/store\/[^/]+/);
      return match ? match[0] : "";
    } catch {
      return "";
    }
  }

  function openItemsTab() {
    // Send merchants directly to the Loyalty Items page inside the embedded app
    const fallback = `apps/${APP_HANDLE}/loyalty-items`;
    const storePrefix = getStorePrefixFromPath();
    const destination = `${storePrefix || ""}${fallback}`;

    try {
      if (shopify?.navigation?.navigate) {
        shopify.navigation.navigate(destination);
        return;
      }
    } catch {}

    try {
      if (window?.top?.location) {
        window.top.location.assign(destination);
        return;
      }
    } catch {}

    try {
      if (window?.location) {
        window.location.assign(destination);
      }
    } catch {}
  }

  if (!productId) {
    return <s-text>Loading product...</s-text>;
  }

  return (
    <s-admin-block heading="Loyalty Rewards Settings">
      <s-stack direction="block" gap="base">
        <s-text>
          Open the products tab to view and manage loyalty  product.
        </s-text>

        <s-box>
          <s-button variant="primary" onClick={openItemsTab}>
            Open Items Tab
          </s-button>
        </s-box>

        {DEBUG && (
          <s-text>
            Debug - session planEnd: {String(userMeta?.planEnd || "N/A")} | API planEnd:{" "}
            {String(planEndFromApi || "N/A")} | API expired: {expiredFromApi}
          </s-text>
        )}
      </s-stack>
    </s-admin-block>
  );
}
