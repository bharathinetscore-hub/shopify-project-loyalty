import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

const loyaltyTabs = [
  { id: "loyalty-points-earned", label: "Loyalty Points Earned" },
  { id: "redeem-points-history", label: "Redeem Points History" },
  { id: "refer-your-friend", label: "Refer Your Friend" },
  { id: "generate-gift-card", label: "Generate Gift Card" },
  { id: "loyalty-tiers", label: "Loyalty Tiers" },
  { id: "update-profile", label: "Update Profile" },
];

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
  return PRODUCTION_API_BASE;
}

const API_BASE = resolveApiBase();

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStoredDate(value) {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatCurrency(value) {
  return `$${toNumber(value, 0).toFixed(2)}`;
}

function normalizePerPage(value) {
  const parsed = Math.floor(toNumber(value, 10));
  return Math.max(1, Math.min(10, parsed || 10));
}

function paginateRows(rows, page, perPage) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safePerPage = normalizePerPage(perPage);
  const totalPages = Math.max(1, Math.ceil(safeRows.length / safePerPage));
  const safePage = Math.max(1, Math.min(totalPages, Math.floor(toNumber(page, 1)) || 1));
  const startIndex = (safePage - 1) * safePerPage;

  return {
    rows: safeRows.slice(startIndex, startIndex + safePerPage),
    page: safePage,
    perPage: safePerPage,
    totalPages,
    totalItems: safeRows.length,
  };
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

async function getCustomerContext(runtimeApi) {
  const idCandidates = [
    runtimeApi?.authenticatedAccount?.customer?.id,
    runtimeApi?.customer?.id,
    runtimeApi?.buyerIdentity?.customer?.id,
    globalThis?.shopify?.customer?.id,
  ];
  const emailCandidates = [
    runtimeApi?.authenticatedAccount?.customer?.email,
    runtimeApi?.customer?.email,
    runtimeApi?.buyerIdentity?.customer?.email,
    globalThis?.shopify?.customer?.email,
  ];
  const firstNameCandidates = [
    runtimeApi?.authenticatedAccount?.customer?.firstName,
    runtimeApi?.customer?.firstName,
    runtimeApi?.buyerIdentity?.customer?.firstName,
    globalThis?.shopify?.customer?.firstName,
  ];
  const lastNameCandidates = [
    runtimeApi?.authenticatedAccount?.customer?.lastName,
    runtimeApi?.customer?.lastName,
    runtimeApi?.buyerIdentity?.customer?.lastName,
    globalThis?.shopify?.customer?.lastName,
  ];
  const displayNameCandidates = [
    runtimeApi?.authenticatedAccount?.customer?.displayName,
    runtimeApi?.customer?.displayName,
    runtimeApi?.buyerIdentity?.customer?.displayName,
    globalThis?.shopify?.customer?.displayName,
  ];

  const customerIdRaw = idCandidates.map(cleanText).find(Boolean) || "";
  const customerEmail = emailCandidates.map(cleanText).find(Boolean) || "";
  const customerId = parseCustomerId(customerIdRaw);
  const customerName =
    displayNameCandidates.map(cleanText).find(Boolean) ||
    [firstNameCandidates.map(cleanText).find(Boolean), lastNameCandidates.map(cleanText).find(Boolean)]
      .filter(Boolean)
      .join(" ");

  if (customerId || customerEmail || customerName) {
    return { customerIdRaw, customerId, customerEmail, customerName };
  }

  try {
    const getToken =
      (typeof runtimeApi?.sessionToken?.get === "function" && runtimeApi.sessionToken.get.bind(runtimeApi.sessionToken)) ||
      (typeof globalThis?.shopify?.sessionToken?.get === "function" &&
        globalThis.shopify.sessionToken.get.bind(globalThis.shopify.sessionToken)) ||
      null;
    if (getToken) {
      const token = await getToken();
      const payload = decodeJwtPayload(token);
      const sub = cleanText(payload?.sub || "");
      const email = cleanText(payload?.email || "");
      return {
        customerIdRaw: sub,
        customerId: parseCustomerId(sub),
        customerEmail: email,
        customerName: cleanText(payload?.name || ""),
      };
    }
  } catch {
    // no-op
  }

  return { customerIdRaw: "", customerId: "", customerEmail: "", customerName: "" };
}

function LoyaltyRewardsProfileSection({ runtimeApi }) {
  const [activeTab, setActiveTab] = useState("loyalty-points-earned");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [usedReferralCode, setUsedReferralCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerContext, setCustomerContext] = useState({
    customerIdRaw: "",
    customerId: "",
    customerEmail: "",
    customerName: "",
  });
  const [giftCardPoints, setGiftCardPoints] = useState("");
  const [giftCardReceiverEmail, setGiftCardReceiverEmail] = useState("");
  const [giftCardError, setGiftCardError] = useState("");
  const [giftCardSuccess, setGiftCardSuccess] = useState("");
  const [giftCardSubmitting, setGiftCardSubmitting] = useState(false);
  const [referFriendEmail, setReferFriendEmail] = useState("");
  const [referFriendError, setReferFriendError] = useState("");
  const [referFriendSuccess, setReferFriendSuccess] = useState("");
  const [referFriendSubmitting, setReferFriendSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [pointsPage, setPointsPage] = useState(1);
  const [pointsPerPage, setPointsPerPage] = useState(10);
  const [redeemPage, setRedeemPage] = useState(1);
  const [redeemPerPage, setRedeemPerPage] = useState(10);
  const [data, setData] = useState({
    labels: {},
    profile: {
      birthday: null,
      anniversary: null,
      referralCode: "",
      usedReferralCode: "",
    },
    loyaltyPointsEarned: {
      totalEarnedPoints: 0,
      totalRedeemedPoints: 0,
      availablePoints: 0,
      rows: [],
    },
    redeemHistory: { rows: [] },
    loyaltyTiers: {
      rows: [],
      summary: {
        currentTier: null,
        nextTier: null,
        progressPercent: 0,
        pointsToNextTier: 0,
        progressCurrentThreshold: 0,
        progressNextThreshold: 0,
        isHighestTier: false,
      },
    },
    giftCardConfig: {
      minimumRedemptionPoints: 0,
      eachPointValue: 1,
      loyaltyPointValue: 1,
      giftcardExpiryDays: 0,
    },
    globalLoyaltyEnabled: false,
    customerEligible: false,
    referralCodeAtSignupEnabled: false,
    referFriendEnabled: false,
    giftCertificateGenerationEnabled: false,
    tiersInfoEnabled: false,
    profileInfoEnabled: false,
  });

  async function loadData({ cancelled = false } = {}) {
    setLoading(true);
    setError("");
    try {
      if (!API_BASE) {
        throw new Error("Missing app URL for extension API");
      }
      const nextCustomerContext = await getCustomerContext(runtimeApi);
      const response = await fetch(`${API_BASE}/api/loyalty/get-customer-account-view-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(nextCustomerContext),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load loyalty data");
      }
      if (!cancelled) {
        setCustomerContext(nextCustomerContext);
        setData({
          labels: payload?.labels || {},
          profile: payload?.profile || {
            birthday: null,
            anniversary: null,
            referralCode: "",
            usedReferralCode: "",
          },
          loyaltyPointsEarned: payload?.loyaltyPointsEarned || {
            totalEarnedPoints: 0,
            totalRedeemedPoints: 0,
            availablePoints: 0,
            rows: [],
          },
          redeemHistory: payload?.redeemHistory || { rows: [] },
          loyaltyTiers: payload?.loyaltyTiers || {
            rows: [],
            summary: {
              currentTier: null,
              nextTier: null,
              progressPercent: 0,
              pointsToNextTier: 0,
              progressCurrentThreshold: 0,
              progressNextThreshold: 0,
              isHighestTier: false,
            },
          },
          giftCardConfig: payload?.giftCardConfig || {
            minimumRedemptionPoints: 0,
            eachPointValue: 1,
            loyaltyPointValue: 1,
            giftcardExpiryDays: 0,
          },
          globalLoyaltyEnabled: Boolean(payload?.globalLoyaltyEnabled),
          customerEligible: Boolean(payload?.customerEligible),
          referralCodeAtSignupEnabled: Boolean(
            payload?.referralCodeAtSignupEnabled
          ),
          referFriendEnabled: Boolean(payload?.referFriendEnabled),
          giftCertificateGenerationEnabled: Boolean(
            payload?.giftCertificateGenerationEnabled
          ),
          tiersInfoEnabled: Boolean(payload?.tiersInfoEnabled),
          profileInfoEnabled: Boolean(payload?.profileInfoEnabled),
        });
        const profile = payload?.profile || {};
        setBirthday(normalizeStoredDate(profile?.birthday));
        setAnniversary(normalizeStoredDate(profile?.anniversary));
        setUsedReferralCode(cleanText(profile?.usedReferralCode));
      }
    } catch (err) {
      if (!cancelled) {
        setError(err?.message || "Failed to load loyalty data");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    loadData({ cancelled });
    return () => {
      cancelled = true;
    };
  }, [runtimeApi]);

  const tableHeaders = useMemo(
    () => ["Date", "Activity Performed", "Reference ID", "Points Earned"],
    []
  );
  const redeemTableHeaders = useMemo(
    () => ["Date", "Activity Performed", "Reference ID", "Points Redeemed", "Amount"],
    []
  );

  const pointsSummary = data?.loyaltyPointsEarned || {
    totalEarnedPoints: 0,
    totalRedeemedPoints: 0,
    availablePoints: 0,
    rows: [],
  };
  const redeemRows = data?.redeemHistory?.rows || [];
  const pagedPointsRows = useMemo(
    () => paginateRows(pointsSummary.rows || [], pointsPage, pointsPerPage),
    [pointsSummary.rows, pointsPage, pointsPerPage]
  );
  const pagedRedeemRows = useMemo(
    () => paginateRows(redeemRows, redeemPage, redeemPerPage),
    [redeemRows, redeemPage, redeemPerPage]
  );
  const labels = data?.labels || {};
  const profile = data?.profile || {
    birthday: null,
    anniversary: null,
    referralCode: "",
    usedReferralCode: "",
  };
  const loyaltyTierRows = data?.loyaltyTiers?.rows || [];
  const loyaltyTierSummary = data?.loyaltyTiers?.summary || {
    currentTier: null,
    nextTier: null,
    progressPercent: 0,
    pointsToNextTier: 0,
    progressCurrentThreshold: 0,
    progressNextThreshold: 0,
    isHighestTier: false,
  };
  const giftCardConfig = data?.giftCardConfig || {
    minimumRedemptionPoints: 0,
    eachPointValue: 1,
    loyaltyPointValue: 1,
    giftcardExpiryDays: 0,
  };
  const availablePoints = Math.max(0, toNumber(pointsSummary.availablePoints, 0));
  const minimumRedemptionPoints = Math.max(0, toNumber(giftCardConfig.minimumRedemptionPoints, 0));
  const eachPointValue = toNumber(giftCardConfig.eachPointValue, 1);
  const loyaltyPointValue = toNumber(giftCardConfig.loyaltyPointValue, 1);
  const maxGiftCardAmount =
    eachPointValue > 0 && loyaltyPointValue > 0
      ? (availablePoints / eachPointValue) * loyaltyPointValue
      : 0;
  const isGiftCardEligible =
    minimumRedemptionPoints <= 0 || availablePoints >= minimumRedemptionPoints;
  const canShowGiftCardSection =
    Boolean(data?.globalLoyaltyEnabled) &&
    Boolean(data?.customerEligible) &&
    Boolean(data?.giftCertificateGenerationEnabled);
  const canShowReferFriendSection =
    Boolean(data?.globalLoyaltyEnabled) &&
    Boolean(data?.customerEligible) &&
    Boolean(data?.referFriendEnabled);
  const canShowReferralCodeField =
    Boolean(data?.globalLoyaltyEnabled) &&
    Boolean(data?.customerEligible) &&
    Boolean(data?.referralCodeAtSignupEnabled);
  const canShowTiersSection =
    Boolean(data?.globalLoyaltyEnabled) &&
    Boolean(data?.customerEligible) &&
    Boolean(data?.tiersInfoEnabled);
  const canShowProfileSection =
    Boolean(data?.globalLoyaltyEnabled) &&
    Boolean(data?.customerEligible) &&
    Boolean(data?.profileInfoEnabled);
  const shouldShowLoyaltyInformation =
    Boolean(data?.globalLoyaltyEnabled) &&
    Boolean(data?.customerEligible);
  const enteredGiftCardPoints = cleanText(giftCardPoints) === "" ? NaN : Number(giftCardPoints);
  const calculatedRedeemAmount =
    Number.isFinite(enteredGiftCardPoints) && enteredGiftCardPoints > 0 && eachPointValue > 0
      ? (enteredGiftCardPoints / eachPointValue) * loyaltyPointValue
      : 0;
  const giftCardValidationMessage = useMemo(() => {
    if (cleanText(giftCardPoints) === "") return "";
    if (!Number.isFinite(enteredGiftCardPoints) || enteredGiftCardPoints <= 0) {
      return "Enter valid points to redeem.";
    }
    if (enteredGiftCardPoints > availablePoints) {
      return `Redeem points cannot exceed available points (${availablePoints.toFixed(2)}).`;
    }
    return "";
  }, [availablePoints, enteredGiftCardPoints, giftCardPoints]);

  useEffect(() => {
    setPointsPage(1);
  }, [pointsPerPage]);

  useEffect(() => {
    setRedeemPage(1);
  }, [redeemPerPage]);

  useEffect(() => {
    if (pointsPage > pagedPointsRows.totalPages) {
      setPointsPage(pagedPointsRows.totalPages);
    }
  }, [pointsPage, pagedPointsRows.totalPages]);

  useEffect(() => {
    if (redeemPage > pagedRedeemRows.totalPages) {
      setRedeemPage(pagedRedeemRows.totalPages);
    }
  }, [redeemPage, pagedRedeemRows.totalPages]);

  function renderPaginationControls({
    page,
    totalPages,
    perPage,
    totalItems,
    onPrev,
    onNext,
    onPerPageChange,
  }) {
    return (
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="loose">
        <s-box inlineSize="72px">
          <s-select
            label=""
            labelAccessibilityVisibility="exclusive"
            value={String(perPage)}
            onChange={(event) => {
              onPerPageChange(normalizePerPage(event.currentTarget.value));
            }}
          >
            <s-option value="1">1</s-option>
            <s-option value="2">2</s-option>
            <s-option value="3">3</s-option>
            <s-option value="4">4</s-option>
            <s-option value="5">5</s-option>
            <s-option value="6">6</s-option>
            <s-option value="7">7</s-option>
            <s-option value="8">8</s-option>
            <s-option value="9">9</s-option>
            <s-option value="10">10</s-option>
          </s-select>
        </s-box>

        <s-stack direction="inline" gap="base">
          <s-button disabled={page <= 1} onClick={onPrev}>
            Previous
          </s-button>
          <s-button disabled={page >= totalPages || totalItems === 0} onClick={onNext}>
            Next
          </s-button>
        </s-stack>
      </s-stack>
    );
  }

  async function handleShareReferralCode() {
    setReferFriendError("");
    setReferFriendSuccess("");

    if (!canShowReferFriendSection) {
      setReferFriendError("This feature is disabled temporaryly.");
      return;
    }

    if (!API_BASE) {
      setReferFriendError("Missing app URL for extension API");
      return;
    }

    if (!cleanText(profile?.referralCode)) {
      setReferFriendError("Referral code is not available.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(referFriendEmail))) {
      setReferFriendError("Enter a valid email.");
      return;
    }

    setReferFriendSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/loyalty/share-referral-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customerId: customerContext?.customerId,
          customerEmail: customerContext?.customerEmail,
          customerName: customerContext?.customerName,
          receiverEmail: cleanText(referFriendEmail),
          referralCode: cleanText(profile?.referralCode),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to share referral code");
      }

      setReferFriendSuccess(
        payload?.emailSent
          ? `Referral code ${cleanText(payload?.referralCode)} emailed to ${cleanText(payload?.receiverEmail)}.`
          : cleanText(payload?.message || payload?.emailError || "Referral email could not be sent.")
      );
      setReferFriendEmail("");
    } catch (err) {
      setReferFriendError(err?.message || "Failed to share referral code");
    } finally {
      setReferFriendSubmitting(false);
    }
  }

  async function handleGenerateGiftCard() {
    setGiftCardError("");
    setGiftCardSuccess("");

    if (!API_BASE) {
      setGiftCardError("Missing app URL for extension API");
      return;
    }

    if (giftCardValidationMessage) {
      setGiftCardError(giftCardValidationMessage);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(giftCardReceiverEmail))) {
      setGiftCardError("Enter a valid receiver email.");
      return;
    }

    setGiftCardSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/loyalty/redeem-gift-card`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customerId: customerContext?.customerId,
          customerEmail: customerContext?.customerEmail,
          receiverEmail: cleanText(giftCardReceiverEmail),
          redeemPoints: enteredGiftCardPoints,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to generate gift card");
      }

      setGiftCardSuccess(
        payload?.emailSent
          ? `Gift card coupon ${cleanText(payload?.giftCode)} generated for ${formatCurrency(
              payload?.giftAmount
            )} and emailed to ${cleanText(payload?.receiverEmail)}.`
          : `Gift card coupon ${cleanText(payload?.giftCode)} generated for ${formatCurrency(
              payload?.giftAmount
            )}. ${cleanText(payload?.message || payload?.emailError)}`
      );
      setGiftCardPoints("");
      setGiftCardReceiverEmail("");
      setData((prev) => {
        const current = prev?.loyaltyPointsEarned || {};
        const nextSummary = payload?.summary || {};
        const nextRow = payload?.row
          ? {
              date: normalizeStoredDate(payload.row.date_created) || "-",
              activityPerformed: payload.row.event_name || "Gift Card",
              referenceId: payload.giftCode || payload.row.id || "-",
              pointsRedeemed: Number(payload.row.points_redeemed || enteredGiftCardPoints || 0),
              amount: Number(payload?.giftAmount || 0),
            }
          : null;

        return {
          ...prev,
          loyaltyPointsEarned: {
            ...current,
            totalEarnedPoints: Number(nextSummary.totalEarnedPoints ?? current.totalEarnedPoints ?? 0),
            totalRedeemedPoints: Number(
              nextSummary.totalRedeemedPoints ?? current.totalRedeemedPoints ?? 0
            ),
            availablePoints: Number(nextSummary.availablePoints ?? current.availablePoints ?? 0),
            rows: current.rows || [],
          },
          redeemHistory: {
            rows: nextRow ? [nextRow, ...(prev?.redeemHistory?.rows || [])] : prev?.redeemHistory?.rows || [],
          },
        };
      });
    } catch (err) {
      setGiftCardError(err?.message || "Failed to generate gift card");
    } finally {
      setGiftCardSubmitting(false);
    }
  }

  async function handleSaveProfile() {
    setProfileError("");
    setProfileSuccess("");

    if (!canShowProfileSection) {
      setProfileError("This feature is disabled temporaryly.");
      return;
    }

    if (!API_BASE) {
      setProfileError("Missing app URL for extension API");
      return;
    }

    if (!customerContext?.customerId) {
      setProfileError("Customer account could not be identified.");
      return;
    }

    if (
      !cleanText(birthday) &&
      !cleanText(anniversary) &&
      (!canShowReferralCodeField || !cleanText(usedReferralCode))
    ) {
      setProfileError(
        canShowReferralCodeField
          ? "Enter birthday, anniversary date, or a referral code."
          : "Enter birthday or anniversary date."
      );
      return;
    }

    setProfileSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/loyalty/save-customer-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customerId: customerContext.customerId,
          customerEmail: customerContext.customerEmail,
          customerName: customerContext.customerName,
          birthday: cleanText(birthday),
          anniversary: cleanText(anniversary),
          usedReferralCode: cleanText(usedReferralCode),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to save profile");
      }

      const awardedEvents = Array.isArray(payload?.awardedEvents) ? payload.awardedEvents : [];
      const awardedPoints = toNumber(payload?.customer?.newPointsAwarded, 0);
      const successMessage = awardedEvents.length
        ? `Profile saved. Awarded ${awardedPoints.toFixed(2)} loyalty points for ${awardedEvents
            .map((item) => item.name)
            .join(" and ")}.`
        : cleanText(payload?.customer?.usedReferralCode)
          ? "Profile saved. Referral code was recorded."
          : "Profile saved.";

      setProfileSuccess(successMessage);
      await loadData();
    } catch (err) {
      setProfileError(err?.message || "Failed to save profile");
    } finally {
      setProfileSubmitting(false);
    }
  }

  function renderPointsEarnedLayout() {
    return (
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          <s-box background="base" border="none" borderRadius="base" padding="base">
            <s-stack direction="block" gap="tight" alignItems="center">
              <s-text type="strong">{pointsSummary.totalEarnedPoints || 0}</s-text>
              <s-text>TOTAL POINTS EARNED</s-text>
            </s-stack>
          </s-box>

          <s-box background="subdued" border="none" borderRadius="base" padding="base">
            <s-stack direction="block" gap="tight" alignItems="center">
              <s-text type="strong">{pointsSummary.availablePoints || 0}</s-text>
              <s-text>AVAILABLE POINTS</s-text>
            </s-stack>
          </s-box>

          <s-box background="base" border="none" borderRadius="base" padding="base">
            <s-stack direction="block" gap="tight" alignItems="center">
              <s-text type="strong">{pointsSummary.totalRedeemedPoints || 0}</s-text>
              <s-text>TOTAL POINTS REDEEMED</s-text>
            </s-stack>
          </s-box>
        </s-grid>

        <s-box border="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="none">
            <s-grid gridTemplateColumns="1fr 2fr 1fr 1fr" gap="none">
              {tableHeaders.map((header) => (
                <s-box key={header} border="base" padding="base">
                  <s-text type="strong">{header}</s-text>
                </s-box>
              ))}
            </s-grid>

            {pagedPointsRows.rows.map((row, idx) => (
              <s-grid key={`${row.referenceId || idx}`} gridTemplateColumns="1fr 2fr 1fr 1fr" gap="none">
                <s-box border="base" padding="base">
                  <s-text>{normalizeStoredDate(row.date) || "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.activityPerformed || "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.referenceId || "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.pointsEarned ?? "-"}</s-text>
                </s-box>
              </s-grid>
            ))}
          </s-stack>
        </s-box>

        {renderPaginationControls({
          page: pagedPointsRows.page,
          totalPages: pagedPointsRows.totalPages,
          perPage: pagedPointsRows.perPage,
          totalItems: pagedPointsRows.totalItems,
          onPrev: () => setPointsPage((current) => Math.max(1, current - 1)),
          onNext: () =>
            setPointsPage((current) => Math.min(pagedPointsRows.totalPages, current + 1)),
          onPerPageChange: setPointsPerPage,
        })}
      </s-stack>
    );
  }

  function renderRedeemHistoryLayout() {
    return (
      <s-stack direction="block" gap="base">
        <s-box border="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="none">
            <s-grid gridTemplateColumns="1fr 2fr 1fr 1fr 1fr" gap="none">
              {redeemTableHeaders.map((header) => (
                <s-box key={header} border="base" padding="base">
                  <s-text type="strong">{header}</s-text>
                </s-box>
              ))}
            </s-grid>

            {pagedRedeemRows.rows.map((row, idx) => (
              <s-grid key={`${row.referenceId || idx}`} gridTemplateColumns="1fr 2fr 1fr 1fr 1fr" gap="none">
                <s-box border="base" padding="base">
                  <s-text>{normalizeStoredDate(row.date) || "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.activityPerformed || "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.referenceId || "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.pointsRedeemed ?? "-"}</s-text>
                </s-box>
                <s-box border="base" padding="base">
                  <s-text>{row.amount ?? "-"}</s-text>
                </s-box>
              </s-grid>
            ))}
          </s-stack>
        </s-box>

        {renderPaginationControls({
          page: pagedRedeemRows.page,
          totalPages: pagedRedeemRows.totalPages,
          perPage: pagedRedeemRows.perPage,
          totalItems: pagedRedeemRows.totalItems,
          onPrev: () => setRedeemPage((current) => Math.max(1, current - 1)),
          onNext: () =>
            setRedeemPage((current) => Math.min(pagedRedeemRows.totalPages, current + 1)),
          onPerPageChange: setRedeemPerPage,
        })}
      </s-stack>
    );
  }

  function renderReferFriendLayout() {
    if (!canShowReferFriendSection) {
      return (
        <s-box border="base" borderRadius="base" padding="base" background="base">
          <s-box border="base" borderRadius="small" padding="tight">
            <s-text tone="critical">This feature is disabled temporaryly.</s-text>
          </s-box>
        </s-box>
      );
    }

    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="base" alignItems="center">
          <s-text>
            Share your code with your friend. On signup, you can get points and they can get points too.
          </s-text>

          <s-stack direction="inline" gap="tight" alignItems="center">
            <s-text>Your Code:</s-text>
            <s-box background="subdued" borderRadius="small" padding="tight">
              <s-text type="strong">{cleanText(profile?.referralCode) || "-"}</s-text>
            </s-box>
          </s-stack>

          <s-box inlineSize="400px">
            <s-text-field
              label="Enter email here..."
              value={referFriendEmail}
              onInput={(event) => {
                setReferFriendEmail(event.currentTarget.value);
                setReferFriendError("");
                setReferFriendSuccess("");
              }}
            />
          </s-box>

          {referFriendError ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="critical">{referFriendError}</s-text>
            </s-box>
          ) : null}

          {referFriendSuccess ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="success">{referFriendSuccess}</s-text>
            </s-box>
          ) : null}

          <s-button
            variant="primary"
            loading={referFriendSubmitting}
            disabled={referFriendSubmitting || !cleanText(profile?.referralCode)}
            onClick={handleShareReferralCode}
          >
            Share & Earn
          </s-button>
        </s-stack>
      </s-box>
    );
  }

  function renderGenerateGiftCardLayout() {
    if (!canShowGiftCardSection) {
      return (
        <s-box border="base" borderRadius="base" padding="base" background="base">
          <s-box border="base" borderRadius="small" padding="tight">
            <s-text tone="critical">This feature is disabled temporaryly.</s-text>
          </s-box>
        </s-box>
      );
    }

    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="base">
          <s-text type="strong" tone="critical">GIFT CERTIFICATE</s-text>

          <s-text>
            Congratulations! You can turn your loyalty points into a gift card!
          </s-text>

          <s-box border="base" borderRadius="small" padding="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text>Points Available: {availablePoints.toFixed(2)}</s-text>
              <s-text>Max Amount: {formatCurrency(maxGiftCardAmount)}</s-text>
            </s-stack>
          </s-box>

          {/* <s-box border="base" borderRadius="small" padding="base">
            <s-stack direction="block" gap="tight">
              <s-text>Minimum redeemable points: {minimumRedemptionPoints.toFixed(2)}</s-text>
              <s-text>Maximum redeemable points: {availablePoints.toFixed(2)}</s-text>
              <s-text>Redeem amount: {formatCurrency(calculatedRedeemAmount)}</s-text>
            </s-stack>
          </s-box> */}

          <s-text-field
            label="Points to redeem"
            value={giftCardPoints}
            inputMode="decimal"
            disabled={!isGiftCardEligible}
            onInput={(event) => {
              setGiftCardPoints(event.currentTarget.value);
              setGiftCardError("");
              setGiftCardSuccess("");
            }}
          />
          <s-text-field
            label="Receiver's Email"
            value={giftCardReceiverEmail}
            disabled={!isGiftCardEligible}
            onInput={(event) => {
              setGiftCardReceiverEmail(event.currentTarget.value);
              setGiftCardError("");
              setGiftCardSuccess("");
            }}
          />

          {!isGiftCardEligible ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="critical">
                You need at least {minimumRedemptionPoints.toFixed(2)} available points to redeem a gift card.
              </s-text>
            </s-box>
          ) : null}
          {giftCardError ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="critical">{giftCardError}</s-text>
            </s-box>
          ) : null}
          {!giftCardError && giftCardValidationMessage ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="critical">{giftCardValidationMessage}</s-text>
            </s-box>
          ) : null}
          {giftCardSuccess ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="success">{giftCardSuccess}</s-text>
            </s-box>
          ) : null}

          <s-button
            variant="primary"
            tone="critical"
            loading={giftCardSubmitting}
            disabled={
              giftCardSubmitting ||
              loading ||
              !customerContext?.customerId ||
              !isGiftCardEligible
            }
            onClick={handleGenerateGiftCard}
          >
            Generate Gift Card
          </s-button>
        </s-stack>
      </s-box>
    );
  }

  function renderLoyaltyTiersLayout() {
    if (!canShowTiersSection) {
      return (
        <s-box border="base" borderRadius="base" padding="base" background="base">
          <s-box border="base" borderRadius="small" padding="tight">
            <s-text tone="critical">This feature is disabled temporaryly.</s-text>
          </s-box>
        </s-box>
      );
    }

    const currentTier = loyaltyTierSummary?.currentTier || null;
    const nextTier = loyaltyTierSummary?.nextTier || null;
    const currentTierName = currentTier?.name || "None";
    const nextTierName = nextTier?.name || "No upcoming tier";
    const progressPercent = Math.max(0, Math.min(100, toNumber(loyaltyTierSummary?.progressPercent, 0)));
    const pointsToNextTier = Math.max(0, toNumber(loyaltyTierSummary?.pointsToNextTier, 0));
    const visibleTiers = currentTier ? [currentTier, nextTier].filter(Boolean) : [nextTier].filter(Boolean);
    const progressHeading = nextTier ? `Progress to ${nextTier.name}` : "Tier Progress";

    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="loose">
          <s-text type="strong">Your Loyalty Tier</s-text>

          <s-stack direction="block" gap="tight">
            <s-text>
              Current Tier: {currentTierName}
            </s-text>
            <s-text>
              Your Points: {availablePoints.toFixed(2)}
            </s-text>

            {nextTier ? (
              <s-stack direction="block" gap="tight">
                <s-text type="strong">{progressHeading}</s-text>
                <s-box
                  background="subdued"
                  borderRadius="small"
                  overflow="hidden"
                  minBlockSize="12px"
                >
                  <s-box
                    background="success"
                    borderRadius="small"
                    minBlockSize="12px"
                    inlineSize={`${progressPercent}%`}
                  />
                </s-box>
                <s-text>
                  Need {pointsToNextTier.toFixed(2)} more points to reach {nextTier.name}!
                </s-text>
              </s-stack>
            ) : (
              <s-text tone="success">You are already in the highest tier.</s-text>
            )}
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text type="strong">Available Tiers</s-text>
            {visibleTiers.length ? (
              <s-grid
                gridTemplateColumns={visibleTiers.length > 1 ? "1fr 1fr" : "1fr"}
                gap="base"
              >
                {visibleTiers.map((tier) => {
                  const isCurrent = currentTier && tier.id === currentTier.id;
                  return (
                    <s-box
                      key={tier.id || tier.name}
                      border="base"
                      borderRadius="base"
                      padding="base"
                      background={isCurrent ? "success-subdued" : "base"}
                    >
                      <s-stack direction="block" gap="tight" alignItems="center">
                        <s-text type="strong">{tier.name || "-"}</s-text>
                        <s-text>
                          Level {toNumber(tier.level, 0)}: {toNumber(tier.threshold, 0).toFixed(2)} Points and above
                        </s-text>
                        <s-text>
                          {toNumber(tier.pointsPerDollar, 0).toFixed(2)}x Points Multiplier
                        </s-text>
                        {tier.description ? <s-text>{tier.description}</s-text> : null}
                      </s-stack>
                    </s-box>
                  );
                })}
              </s-grid>
            ) : (
              <s-text>No active loyalty tiers configured.</s-text>
            )}
          </s-stack>
        </s-stack>
      </s-box>
    );
  }

  function renderUpdateProfileLayout() {
    if (!canShowProfileSection) {
      return (
        <s-box border="base" borderRadius="base" padding="base" background="base">
          <s-box border="base" borderRadius="small" padding="tight">
            <s-text tone="critical">This feature is disabled temporaryly.</s-text>
          </s-box>
        </s-box>
      );
    }

    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="base">
          <s-text type="strong">Update Profile</s-text>

          <s-date-field
            label="Birthday"
            value={birthday}
            disabled={Boolean(cleanText(profile?.birthday))}
            onInput={(event) => {
              setBirthday(event.currentTarget.value);
              setProfileError("");
              setProfileSuccess("");
            }}
          />

          <s-date-field
            label="Anniversary Date"
            value={anniversary}
            disabled={Boolean(cleanText(profile?.anniversary))}
            onInput={(event) => {
              setAnniversary(event.currentTarget.value);
              setProfileError("");
              setProfileSuccess("");
            }}
          />

          {canShowReferralCodeField ? (
            <s-text-field
              label="Referral Code"
              value={usedReferralCode}
              disabled={Boolean(cleanText(profile?.usedReferralCode))}
              onInput={(event) => {
                setUsedReferralCode(event.currentTarget.value);
                setProfileError("");
                setProfileSuccess("");
              }}
            />
          ) : null}

          {profileError ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="critical">{profileError}</s-text>
            </s-box>
          ) : null}

          {profileSuccess ? (
            <s-box border="base" borderRadius="small" padding="tight">
              <s-text tone="success">{profileSuccess}</s-text>
            </s-box>
          ) : null}

          <s-button
            variant="primary"
            loading={profileSubmitting}
            disabled={
              profileSubmitting ||
              loading ||
              !customerContext?.customerId ||
              (!cleanText(birthday) &&
                !cleanText(anniversary) &&
                (!canShowReferralCodeField || !cleanText(usedReferralCode)))
            }
            onClick={handleSaveProfile}
          >
            Save
          </s-button>
        </s-stack>
      </s-box>
    );
  }

  if (!loading && !error && !shouldShowLoyaltyInformation) {
    return null;
  }

  return (
    <s-box border="base" borderRadius="base" padding="base" background="base">
      <s-stack direction="block" gap="base">
        <s-text type="strong">{labels.myAccountTabHeading || "Loyalty Rewards Information"}</s-text>
        {loading ? <s-text>Loading loyalty data...</s-text> : null}
        {error ? <s-text tone="critical">{error}</s-text> : null}

        <s-grid gridTemplateColumns="300px 1fr" gap="base">
          <s-box border="base" borderRadius="small" background="base">
            <s-stack direction="block" gap="none">
            {loyaltyTabs.map((tab, index) => (
              <s-box
                key={tab.id}
                padding="base"
                background={activeTab === tab.id || (index === 0 && !activeTab) ? "subdued" : "base"}
                border="base"
              >
                <s-clickable
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                >
                <s-text>
                  {tab.id === "loyalty-points-earned"
                    ? labels.loyaltyPointsEarnedLabel || tab.label
                    : tab.id === "redeem-points-history"
                    ? labels.redeemHistoryLabel || tab.label
                    : tab.id === "refer-your-friend"
                      ? labels.referFriendLabel || tab.label
                      : tab.id === "generate-gift-card"
                        ? labels.giftCardLabel || tab.label
                        : tab.id === "loyalty-tiers"
                          ? labels.tiersLabel || tab.label
                          : tab.id === "update-profile"
                            ? labels.updateProfileLabel || tab.label
                            : tab.label}
                </s-text>
                </s-clickable>
              </s-box>
            ))}
            </s-stack>
          </s-box>

          <s-box border="base" borderRadius="small" background="base" padding="base">
            {activeTab === "loyalty-points-earned" ? (
              renderPointsEarnedLayout()
            ) : activeTab === "redeem-points-history" ? (
              renderRedeemHistoryLayout()
            ) : activeTab === "refer-your-friend" ? (
              renderReferFriendLayout()
            ) : activeTab === "generate-gift-card" ? (
              renderGenerateGiftCardLayout()
            ) : activeTab === "loyalty-tiers" ? (
              renderLoyaltyTiersLayout()
            ) : activeTab === "update-profile" ? (
              renderUpdateProfileLayout()
            ) : (
              <s-stack direction="block" gap="tight">
                <s-text type="strong">
                  {loyaltyTabs.find((tab) => tab.id === activeTab)?.label || "Section"}
                </s-text>
                <s-text>Layout placeholder</s-text>
              </s-stack>
            )}
          </s-box>
        </s-grid>
      </s-stack>
    </s-box>
  );
}

export default async (...args) => {
  const runtimeApi = args?.[1] || args?.[0] || null;
  render(<LoyaltyRewardsProfileSection runtimeApi={runtimeApi} />, document.body);
};
