// Storefront loyalty helper for Shopify product pages.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  (function () {
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

    async function loadProductData() {
      if (productDataPromise) return productDataPromise;

      const url = `${window.location.pathname.replace(/\/$/, "")}.js`;
      productDataPromise = fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

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

    function getCustomerContext() {
      const customerIdCandidates = [
        window.ShopifyAnalytics?.meta?.page?.customerId,
        window.meta?.page?.customerId,
        window.__st?.cid,
        window.Shopify?.customer?.id,
      ];

      const customerEmailCandidates = [
        window.Shopify?.customer?.email,
      ];

      const customerId = customerIdCandidates.map(parseNumericId).find(Boolean) || "";
      const customerEmail = customerEmailCandidates.map(cleanText).find(Boolean) || "";

      return {
        customerId,
        customerEmail,
        loggedIn: Boolean(customerId || customerEmail),
      };
    }

    async function updateRewardPreview() {
      const form = getProductForm();
      if (!form || !API_BASE) {
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
      const customer = getCustomerContext();

      if (!productId || productPrice <= 0) {
        hideWidget();
        return;
      }

      try {
        const params = new URLSearchParams({
          productId: String(productId),
          productPrice: String(productPrice),
        });

        if (customer.customerId) params.set("customerId", customer.customerId);
        if (customer.customerEmail) params.set("customerEmail", customer.customerEmail);

        const res = await fetch(
          `${API_BASE}/api/loyalty/get-product-reward-preview?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.eligible || !toNumber(data?.points, 0)) {
          hideWidget();
          return;
        }

        widget.textContent = cleanText(data?.message) || `Earn ${Math.max(0, Math.round(Number(data.points) || 0))} points`;
        widget.style.display = "block";
      } catch (error) {
        console.warn("Loyalty preview load failed:", error);
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
