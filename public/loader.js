// Storefront loyalty helper for Shopify product pages.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  (function () {
    const DEBUG_PREFIX = "[NetScore Loyalty loader]";
    const API_BASE = (() => {
      try {
        return new URL(document.currentScript?.src || "", window.location.origin).origin;
      } catch {
        return "";
      }
    })();

    const WIDGET_ID = "netscore-loyalty-product-preview";
    let productDataPromise = null;
    let updateTimer = null;

    function debugLog(...args) {
      console.log(DEBUG_PREFIX, ...args);
    }

    function debugWarn(...args) {
      console.warn(DEBUG_PREFIX, ...args);
    }

    function cleanText(value) {
      return String(value || "").trim();
    }

    function toNumber(value, fallback = 0) {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    }

    function parseNumericId(value) {
      return cleanText(value).match(/\d+/)?.[0] || "";
    }

    function getProductForm() {
      return (
        document.querySelector("form[action*='/cart/add']") ||
        document.querySelector("product-form form") ||
        document.querySelector("form[id*='product-form']")
      );
    }

    function getOrCreateWidget(form) {
      if (!form) return null;

      let widget = document.getElementById(WIDGET_ID);
      if (!widget) {
        widget = document.createElement("div");
        widget.id = WIDGET_ID;
        widget.style.display = "none";
        widget.style.margin = "12px 0";
        widget.style.padding = "12px 14px";
        widget.style.border = "1px solid #d6eadc";
        widget.style.borderRadius = "12px";
        widget.style.background = "linear-gradient(180deg, #f4fff7 0%, #eefaf2 100%)";
        widget.style.color = "#166534";
        widget.style.fontSize = "14px";
        widget.style.fontWeight = "600";
        widget.style.lineHeight = "1.4";
        form.prepend(widget);
      }

      return widget;
    }

    function hideWidget() {
      const widget = document.getElementById(WIDGET_ID);
      if (widget) {
        widget.style.display = "none";
        widget.textContent = "";
      }
    }

    function applyEligibleWidgetStyle(widget) {
      widget.style.border = "1px solid #d6eadc";
      widget.style.background = "linear-gradient(180deg, #f4fff7 0%, #eefaf2 100%)";
      widget.style.color = "#166534";
    }

    function applyIneligibleWidgetStyle(widget) {
      widget.style.border = "1px solid #e5e7eb";
      widget.style.background = "#f9fafb";
      widget.style.color = "#6b7280";
    }

    async function loadProductData() {
      if (productDataPromise) return productDataPromise;

      const url = `${window.location.pathname.replace(/\/$/, "")}.js`;
      debugLog("loading product JSON", url);
      productDataPromise = fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
        .then(async (res) => {
          if (!res.ok) {
            debugWarn("product JSON load failed", res.status, url);
            return null;
          }
          const data = await res.json().catch(() => null);
          debugLog("product JSON loaded", {
            productId: parseNumericId(data?.id),
            variants: Array.isArray(data?.variants) ? data.variants.length : 0,
          });
          return data;
        })
        .catch((error) => {
          debugWarn("product JSON fetch error", error);
          return null;
        });

      return productDataPromise;
    }

    function getSelectedVariantId(form, productData) {
      const formVariantId = parseNumericId(
        form?.querySelector("[name='id']")?.value || ""
      );
      if (formVariantId) return formVariantId;

      const searchVariantId = parseNumericId(
        new URLSearchParams(window.location.search).get("variant")
      );
      if (searchVariantId) return searchVariantId;

      const selectedOrFirst = Array.isArray(productData?.variants)
        ? productData.variants.find((variant) => variant?.available) || productData.variants[0]
        : null;
      return parseNumericId(selectedOrFirst?.id);
    }

    function getSelectedVariantPrice(form, productData) {
      const selectedVariantId = getSelectedVariantId(form, productData);
      const variants = Array.isArray(productData?.variants) ? productData.variants : [];
      const variant = variants.find(
        (item) => parseNumericId(item?.id) === selectedVariantId
      );

      if (variant && Number.isFinite(Number(variant.price))) {
        return Number(variant.price) / 100;
      }

      if (Number.isFinite(Number(productData?.price))) {
        return Number(productData.price) / 100;
      }

      return 0;
    }

    async function updateRewardPreview() {
      const form = getProductForm();
      if (!form || !API_BASE) {
        debugWarn("missing form or API base", {
          hasForm: Boolean(form),
          apiBase: API_BASE,
        });
        hideWidget();
        return;
      }

      const widget = getOrCreateWidget(form);
      if (!widget) return;

      const productData = await loadProductData();
      const productId =
        parseNumericId(productData?.id) ||
        parseNumericId(window.ShopifyAnalytics?.meta?.product?.id);
      const productPrice = getSelectedVariantPrice(form, productData);

      if (!productId || productPrice <= 0) {
        debugWarn("missing productId or productPrice", {
          productId,
          productPrice,
        });
        hideWidget();
        return;
      }

      try {
        const params = new URLSearchParams({
          productId: String(productId),
          productPrice: String(productPrice),
        });

        const requestUrl = `${API_BASE}/api/loyalty/get-product-reward-preview?${params.toString()}`;
        debugLog("calling reward preview API", requestUrl);

        const res = await fetch(requestUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await res.json().catch(() => ({}));
        debugLog("reward preview API response", {
          status: res.status,
          data,
        });

        if (!res.ok) {
          debugWarn("reward preview request failed", res.status, data);
          hideWidget();
          return;
        }

        if (data && data.eligible === false) {
          widget.textContent = "Product not eligible";
          applyIneligibleWidgetStyle(widget);
          widget.style.display = "block";
          debugLog("widget displayed (ineligible)", widget.textContent);
          return;
        }

        if (!data?.eligible || !toNumber(data?.points, 0)) {
          debugWarn("reward preview not eligible or no points", data);
          hideWidget();
          return;
        }

        widget.textContent = cleanText(data?.message) || `Earn ${Math.max(0, Math.round(Number(data.points) || 0))} points`;
        applyEligibleWidgetStyle(widget);
        widget.style.display = "block";
        debugLog("widget displayed", widget.textContent);
      } catch (error) {
        debugWarn("loyalty preview load failed", error);
        hideWidget();
      }
    }

    function scheduleUpdate() {
      window.clearTimeout(updateTimer);
      updateTimer = window.setTimeout(() => {
        updateRewardPreview();
      }, 180);
    }

    function boot() {
      debugLog("booting loader", {
        apiBase: API_BASE,
        path: window.location.pathname,
      });
      scheduleUpdate();

      document.addEventListener("change", scheduleUpdate, true);
      document.addEventListener("input", scheduleUpdate, true);

      const observer = new MutationObserver(() => {
        scheduleUpdate();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value", "checked", "selected"],
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  })();
}
