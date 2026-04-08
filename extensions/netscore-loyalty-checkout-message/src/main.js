import "@shopify/ui-extensions/preact";
import { h, render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  useApplyAttributeChange,
  useApplyDiscountCodeChange,
  useAttributeValues,
  useTotalAmount,
} from "@shopify/ui-extensions/checkout/preact";

function resolveApiBase() {
  const PRODUCTION_API_BASE = "https://shopify-project-loyalty.onrender.com";
  const liveOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? String(window.location.origin)
      : "";

  if (/^https:\/\/([a-z0-9-]+\.)trycloudflare\.com$/i.test(liveOrigin)) {
    return liveOrigin.replace(/\/$/, "");
  }

  const envBase =
    (typeof process !== "undefined" &&
      (process.env?.HOST ||
        process.env?.APP_URL ||
        process.env?.SHOPIFY_APP_URL ||
        process.env?.API_BASE_URL)) ||
    (typeof window !== "undefined" && window.__SHOPIFY_APP_URL__);

  if (envBase) return String(envBase).replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    // Shopify dev tunnel (Cloudflare Quick Tunnel only — no ngrok)
    if (/^https:\/\/([a-z0-9-]+\.)trycloudflare\.com$/i.test(o)) {
      return o;
    }
  }
  return PRODUCTION_API_BASE;
}

const API_BASE = resolveApiBase();

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getCheckoutCustomerContext(runtimeApi) {
  const browserShopify = globalThis?.window?.Shopify || null;

  const idCandidates = [
    runtimeApi?.buyerIdentity?.customer?.id,
    runtimeApi?.data?.buyerIdentity?.customer?.id,
    runtimeApi?.customer?.id,
    runtimeApi?.authenticatedAccount?.customer?.id,
    browserShopify?.customer?.id,
    browserShopify?.customerId,
  ];
  const emailCandidates = [
    runtimeApi?.buyerIdentity?.customer?.email,
    runtimeApi?.data?.buyerIdentity?.customer?.email,
    runtimeApi?.customer?.email,
    runtimeApi?.authenticatedAccount?.customer?.email,
    browserShopify?.customer?.email,
  ];

  const customerIdRaw = idCandidates.map(cleanText).find(Boolean) || "";
  const customerEmail = emailCandidates.map(cleanText).find(Boolean) || "";
  const customerId = parseCustomerId(customerIdRaw);

  if (customerId || customerEmail) {
    return { customerId, customerIdRaw, customerEmail };
  }

  try {
    const getToken =
      (typeof runtimeApi?.sessionToken?.get === "function" && runtimeApi.sessionToken.get.bind(runtimeApi.sessionToken)) ||
      (typeof shopify?.sessionToken?.get === "function" && shopify.sessionToken.get.bind(shopify.sessionToken)) ||
      null;
    if (getToken) {
      const token = await getToken();
      const payload = decodeJwtPayload(token);
      const sub = cleanText(payload?.sub || "");
      const email = cleanText(payload?.email || "");
      return {
        customerId: parseCustomerId(sub),
        customerIdRaw: sub,
        customerEmail: email,
      };
    }
  } catch {
    // no-op
  }

  return { customerId: "", customerIdRaw: "", customerEmail: "" };
}

function CheckoutLoyaltyMessage({ runtimeApi }) {
  const applyAttributeChange = useApplyAttributeChange();
  const totalAmount = useTotalAmount();
  let applyDiscountCodeChange;
  try {
    applyDiscountCodeChange = useApplyDiscountCodeChange();
  } catch (error) {
    applyDiscountCodeChange = null;
    console.warn("Discount code updates unavailable in this checkout target.", error);
  }
  const [savedDiscountCode] = useAttributeValues(["netscore_loyalty_discount_code"]);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [availablePoints, setAvailablePoints] = useState(0);
  const [minimumRequiredPoints, setMinimumRequiredPoints] = useState(0);
  const [eachPointValue, setEachPointValue] = useState(1);
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(1);

  const [useAllPoints, setUseAllPoints] = useState(false);
  const [applyPointsInput, setApplyPointsInput] = useState("0");
  const [appliedPoints, setAppliedPoints] = useState(0);
  const [appliedPriceRuleId, setAppliedPriceRuleId] = useState("");
  const [appliedDiscountTitle, setAppliedDiscountTitle] = useState("");
  const [appliedDiscountCode, setAppliedDiscountCode] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLoyaltyData() {
      setLoading(true);
      setErrorText("");
      try {
        const customerContext = await getCheckoutCustomerContext(runtimeApi);
        const res = await fetch(`${API_BASE}/api/loyalty/get-customer-account-view-config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(customerContext),
        });

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data) {
          setErrorText("Failed to load loyalty points.");
          return;
        }

        const points = toNumber(data?.loyaltyPointsEarned?.availablePoints, 0);
        const minimum = toNumber(data?.giftCardConfig?.minimumRedemptionPoints, 0);
        const eachVal = toNumber(data?.giftCardConfig?.eachPointValue, 1);
        const loyaltyVal = toNumber(data?.giftCardConfig?.loyaltyPointValue, 1);

        setAvailablePoints(points);
        setMinimumRequiredPoints(minimum);
        setEachPointValue(eachVal > 0 ? eachVal : 1);
        setLoyaltyPointValue(loyaltyVal > 0 ? loyaltyVal : 1);
        setApplyPointsInput(String(points > 0 ? Math.min(points, 1) : 0));
      } catch {
        if (!cancelled) {
          setErrorText("Failed to load loyalty points.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLoyaltyData();
    return () => {
      cancelled = true;
    };
  }, [runtimeApi]);

  useEffect(() => {
    if (savedDiscountCode && savedDiscountCode !== appliedDiscountCode) {
      setAppliedDiscountCode(savedDiscountCode);
    } else if (!savedDiscountCode && appliedDiscountCode) {
      setAppliedDiscountCode("");
    }
  }, [savedDiscountCode, appliedDiscountCode]);

  const maxAmount = useMemo(() => {
    if (eachPointValue <= 0 || loyaltyPointValue <= 0) return 0;
    return (availablePoints / eachPointValue) * loyaltyPointValue;
  }, [availablePoints, eachPointValue, loyaltyPointValue]);

  const spendingPoints = useMemo(() => {
    const points = toNumber(applyPointsInput, 0);
    return Math.max(0, Math.min(points, availablePoints));
  }, [applyPointsInput, availablePoints]);

  const savingAmount = useMemo(() => {
    if (eachPointValue <= 0 || loyaltyPointValue <= 0) return 0;
    return (spendingPoints / eachPointValue) * loyaltyPointValue;
  }, [spendingPoints, eachPointValue, loyaltyPointValue]);

  const orderRedeemAmount = useMemo(() => {
    if (eachPointValue <= 0 || loyaltyPointValue <= 0) return 0;
    return (appliedPoints / eachPointValue) * loyaltyPointValue;
  }, [appliedPoints, eachPointValue, loyaltyPointValue]);

  const checkoutTotalAmount = useMemo(() => {
    return toNumber(totalAmount?.amount, 0);
  }, [totalAmount]);

  const checkoutTotalAfterRedeem = useMemo(() => {
    return Math.max(0, checkoutTotalAmount - orderRedeemAmount);
  }, [checkoutTotalAmount, orderRedeemAmount]);

  const canUseGiftFeature = minimumRequiredPoints <= 0 || availablePoints >= minimumRequiredPoints;
  async function updateCheckoutAttribute(key, value) {
    const hasValue = cleanText(value) !== "";
    return applyAttributeChange({
      type: hasValue ? "updateAttribute" : "removeAttribute",
      key,
      ...(hasValue ? { value: String(value) } : {}),
    });
  }

  async function syncLoyaltyCheckoutAttributes({ points, amount, ruleId, label, discountCode }) {
    await updateCheckoutAttribute("netscore_loyalty_points", points > 0 ? String(points) : "");
    await updateCheckoutAttribute("netscore_loyalty_amount", amount > 0 ? String(amount) : "");
    await updateCheckoutAttribute("netscore_loyalty_rule_id", cleanText(ruleId));
    await updateCheckoutAttribute("netscore_loyalty_label", cleanText(label));
    await updateCheckoutAttribute("netscore_loyalty_discount_code", cleanText(discountCode));
  }

  async function deleteLoyaltyPriceRule(shop, ruleId) {
    if (!ruleId || !shop) return;
    await fetch(`${API_BASE}/api/loyalty/delete-checkout-loyalty-discount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        priceRuleId: ruleId,
        shop,
      }),
    }).catch(() => null);
  }

  async function removeCheckoutDiscountCode(code) {
    if (!code || !applyDiscountCodeChange) return;
    try {
      await applyDiscountCodeChange({
        type: "removeDiscountCode",
        code,
      });
    } catch (error) {
      console.error("remove discount code error:", error);
    }
  }

  function handleToggleUseAll(event) {
    const checked = Boolean(event?.currentTarget?.checked);
    setUseAllPoints(checked);
    if (checked) {
      setApplyPointsInput(String(availablePoints));
    } else if (appliedPoints <= 0) {
      setApplyPointsInput(String(availablePoints > 0 ? Math.min(availablePoints, 1) : 0));
    }
  }

  async function handleApplyPoints() {
    setFeedback("");
    if (!canUseGiftFeature) {
      setFeedback(
        `You need at least ${minimumRequiredPoints.toFixed(2)} available points to use this feature.`
      );
      return;
    }
    const points = toNumber(applyPointsInput, NaN);
    if (!Number.isFinite(points) || points <= 0) {
      setFeedback("Enter valid points to apply.");
      return;
    }
    if (points > availablePoints) {
      setFeedback(`Points cannot exceed available points (${availablePoints.toFixed(2)}).`);
      return;
    }

    setApplyBusy(true);
    try {
      const customerContext = await getCheckoutCustomerContext(runtimeApi);
      const shop =
        cleanText(globalThis?.window?.Shopify?.shop) ||
        cleanText(runtimeApi?.shop?.storefrontUrl || "").replace(/^https?:\/\//, "").split("/")[0];

      if (appliedDiscountCode) {
        await removeCheckoutDiscountCode(appliedDiscountCode);
      }

      if (appliedPriceRuleId) {
        await deleteLoyaltyPriceRule(shop, appliedPriceRuleId);
      }

      const res = await fetch(`${API_BASE}/api/loyalty/create-checkout-loyalty-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customerId: customerContext.customerId,
          customerEmail: customerContext.customerEmail,
          redeemPoints: points,
          shop,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success || !cleanText(data?.priceRuleId)) {
        setFeedback(cleanText(data?.message) || "Failed to apply loyalty points.");
        return;
      }
      const discountCodeValue = cleanText(data?.code);
      if (!discountCodeValue) {
        await deleteLoyaltyPriceRule(shop, data.priceRuleId);
        setFeedback("Failed to generate loyalty discount code.");
        return;
      }

      if (applyDiscountCodeChange) {
        try {
          await applyDiscountCodeChange({
            type: "addDiscountCode",
            code: discountCodeValue,
          });
        } catch (error) {
          console.error("apply discount code error:", error);
          await deleteLoyaltyPriceRule(shop, data.priceRuleId);
          setFeedback("Failed to apply loyalty discount to checkout.");
          return;
        }
      } else {
        console.warn("Discount code updates are unavailable in this checkout target.");
      }

      await syncLoyaltyCheckoutAttributes({
        points,
        amount: toNumber(data.amount, savingAmount),
        ruleId: data.priceRuleId,
        label: cleanText(data.title) || "Loyalty points applied",
        discountCode: discountCodeValue,
      });

      setAppliedPoints(points);
      setAppliedPriceRuleId(String(data.priceRuleId));
      setAppliedDiscountCode(discountCodeValue);
      setAppliedDiscountTitle(cleanText(data.title) || "Loyalty points applied");
      setApplyPointsInput(String(points));
      setFeedback(
        `Applied ${points.toFixed(2)} points (saving $${toNumber(data.amount, savingAmount).toFixed(2)}).`
      );
    } catch (error) {
      console.error("apply loyalty points error:", error);
      setFeedback("Failed to apply loyalty points.");
    } finally {
      setApplyBusy(false);
    }
  }

  async function handleRemovePoints() {
    setApplyBusy(true);
    setFeedback("");

    try {
      const activeRuleId = cleanText(appliedPriceRuleId);
      const shop =
        cleanText(globalThis?.window?.Shopify?.shop) ||
        cleanText(runtimeApi?.shop?.storefrontUrl || "").replace(/^https?:\/\//, "").split("/")[0];

      if (activeRuleId) {
        await removeCheckoutDiscountCode(appliedDiscountCode);
        const removeRes = await fetch(`${API_BASE}/api/loyalty/delete-checkout-loyalty-discount`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            priceRuleId: activeRuleId,
            shop,
          }),
        });

        const removeData = await removeRes.json().catch(() => ({}));
        if (!removeRes.ok || removeData?.success === false) {
          setFeedback(cleanText(removeData?.message) || "Failed to remove applied loyalty points.");
          return;
        }
      }

      await syncLoyaltyCheckoutAttributes({
        points: 0,
        amount: 0,
        ruleId: "",
        label: "",
        discountCode: "",
      });

      setAppliedPoints(0);
      setAppliedPriceRuleId("");
      setAppliedDiscountTitle("");
      setAppliedDiscountCode("");
      setUseAllPoints(false);
      setApplyPointsInput(String(availablePoints > 0 ? Math.min(availablePoints, 1) : 0));
      setFeedback("Applied points removed.");
    } catch (error) {
      console.error("remove loyalty points error:", error);
      setFeedback("Failed to remove applied loyalty points.");
    } finally {
      setApplyBusy(false);
    }
  }

  if (loading) {
    return h("s-text", null, "Loading loyalty checkout section...");
  }

  return h(
    "s-stack",
    { direction: "block", gap: "base" },
    h(
      "s-box",
      {
        border: "base",
        borderRadius: "base",
        padding: "base",
        background: "base",
      },
      h(
        "s-stack",
        { direction: "block", gap: "base" },
        h("s-text", { type: "strong" }, "Spend Your Loyalty Rewards Points"),
        errorText ? h("s-text", { tone: "critical" }, errorText) : null,
        h(
          "s-stack",
          { direction: "inline", gap: "base" },
          h("s-text", null, `Points Available: ${availablePoints.toFixed(2)}`),
          h("s-text", null, `Max Amount: $${maxAmount.toFixed(2)}`)
        ),
        h("s-text", null, `Order Amount that You Could Redeem: $${orderRedeemAmount.toFixed(2)}`),
        h("s-text", null, `Checkout Total: $${checkoutTotalAmount.toFixed(2)}`),
        h("s-text", null, `Checkout Total After Loyalty: $${checkoutTotalAfterRedeem.toFixed(2)}`),
        h(
          "s-text",
          null,
          `Minimum required available points: ${minimumRequiredPoints.toFixed(2)}`
        ),
        h(
          "s-stack",
          { direction: "inline", gap: "base", alignItems: "center" },
          h("s-checkbox", { checked: useAllPoints, onChange: handleToggleUseAll }),
          h("s-text", null, "Use all available Loyalty Points")
        ),
        h(
          "s-stack",
          { direction: "block", gap: "tight" },
          h("s-text", { type: "strong" }, "Apply Points"),
          h(
            "s-box",
            { maxInlineSize: "180px" },
            h("s-text-field", {
              type: "number",
              value: applyPointsInput,
              min: "0",
              max: String(Math.floor(availablePoints)),
              step: "1",
              onInput: (event) => setApplyPointsInput(event?.currentTarget?.value || ""),
            })
          ),
          h(
            "s-text",
            { tone: "subdued" },
            `You will be spending ${spendingPoints.toFixed(2)} points (SAVING $${savingAmount.toFixed(2)})`
          )
        ),
        h(
          "s-stack",
          { direction: "inline", gap: "base" },
          h(
            "s-box",
            { maxInlineSize: "96px" },
            h(
              "s-button",
              { variant: "primary", onClick: handleApplyPoints, disabled: applyBusy, size: "small" },
              applyBusy ? "Applying..." : "Apply"
            )
          ),
          h(
            "s-box",
            { maxInlineSize: "110px" },
            h(
              "s-button",
              {
                onClick: handleRemovePoints,
                disabled: applyBusy || (!appliedPoints && !appliedPriceRuleId),
                size: "small",
              },
              "Remove"
            )
          )
        ),
        appliedPoints > 0
          ? h(
              "s-text",
              { tone: "subdued" },
              `${appliedDiscountTitle || "Loyalty points applied"}: ${appliedPoints.toFixed(2)} points for $${orderRedeemAmount.toFixed(2)}`
            )
          : null,
        feedback ? h("s-text", { tone: "subdued" }, feedback) : null
      )
    )
  );
}

export default function run(...args) {
  const runtimeApi = args?.[1] || args?.[0] || null;
  render(h(CheckoutLoyaltyMessage, { runtimeApi }), document.body);
}
