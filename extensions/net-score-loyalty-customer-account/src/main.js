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
  return "";
}

const API_BASE = resolveApiBase();

function cleanText(value) {
  return String(value || "").trim();
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

  const customerIdRaw = idCandidates.map(cleanText).find(Boolean) || "";
  const customerEmail = emailCandidates.map(cleanText).find(Boolean) || "";
  const customerId = parseCustomerId(customerIdRaw);

  if (customerId || customerEmail) {
    return { customerIdRaw, customerId, customerEmail };
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
      };
    }
  } catch {
    // no-op
  }

  return { customerIdRaw: "", customerId: "", customerEmail: "" };
}

function LoyaltyRewardsProfileSection({ runtimeApi }) {
  const [activeTab, setActiveTab] = useState("loyalty-points-earned");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    labels: {},
    loyaltyPointsEarned: {
      totalEarnedPoints: 0,
      totalRedeemedPoints: 0,
      availablePoints: 0,
      rows: [],
    },
    redeemHistory: { rows: [] },
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        if (!API_BASE) {
          throw new Error("Missing app URL for extension API");
        }
        const customerContext = await getCustomerContext(runtimeApi);
        const response = await fetch(`${API_BASE}/api/loyalty/get-customer-account-view-config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(customerContext),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to load loyalty data");
        }
        if (!cancelled) {
          setData({
            labels: payload?.labels || {},
            loyaltyPointsEarned: payload?.loyaltyPointsEarned || {
              totalEarnedPoints: 0,
              totalRedeemedPoints: 0,
              availablePoints: 0,
              rows: [],
            },
            redeemHistory: payload?.redeemHistory || { rows: [] },
          });
          const profile = payload?.profile || {};
          setBirthday(cleanText(profile?.birthday));
          setAnniversary(cleanText(profile?.anniversary));
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

    loadData();
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
  const labels = data?.labels || {};

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

            {(pointsSummary.rows || []).map((row, idx) => (
              <s-grid key={`${row.referenceId || idx}`} gridTemplateColumns="1fr 2fr 1fr 1fr" gap="none">
                <s-box border="base" padding="base">
                  <s-text>{row.date || "-"}</s-text>
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

            {redeemRows.map((row, idx) => (
              <s-grid key={`${row.referenceId || idx}`} gridTemplateColumns="1fr 2fr 1fr 1fr 1fr" gap="none">
                <s-box border="base" padding="base">
                  <s-text>{row.date || "-"}</s-text>
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
      </s-stack>
    );
  }

  function renderReferFriendLayout() {
    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="base" alignItems="center">
          <s-text>
            Share your code with your friend. On signup, you can get points and they can get points too.
          </s-text>

          <s-stack direction="inline" gap="tight" alignItems="center">
            <s-text>Your Code:</s-text>
            <s-box background="subdued" borderRadius="small" padding="tight">
              <s-text type="strong">REF1C4CA42</s-text>
            </s-box>
          </s-stack>

          <s-box inlineSize="400px">
            <s-text-field label="Enter email here..." />
          </s-box>

          <s-button variant="primary">Share & Earn</s-button>
        </s-stack>
      </s-box>
    );
  }

  function renderGenerateGiftCardLayout() {
    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="base">
          <s-text type="strong" tone="critical">GIFT CERTIFICATE</s-text>

          <s-text>
            Congratulations! You can turn your loyalty points into a gift card!
          </s-text>

          <s-box border="base" borderRadius="small" padding="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text>Points Available: 105</s-text>
              <s-text>Max Amount: $42.00</s-text>
            </s-stack>
          </s-box>

          <s-text-field label="Points to redeem" />
          <s-text-field label="Receiver's Email" />

          <s-box border="base" borderRadius="small" padding="tight">
            <s-text></s-text>
          </s-box>

          <s-button variant="primary" tone="critical">Generate Gift Card</s-button>
        </s-stack>
      </s-box>
    );
  }

  function renderUpdateProfileLayout() {
    return (
      <s-box border="base" borderRadius="base" padding="base" background="base">
        <s-stack direction="block" gap="base">
          <s-text type="strong">Update Profile</s-text>

          <s-date-field
            label="Birthday"
            value={birthday}
            onInput={(event) => setBirthday(event.currentTarget.value)}
          />

          <s-date-field
            label="Anniversary Date"
            value={anniversary}
            onInput={(event) => setAnniversary(event.currentTarget.value)}
          />

          <s-button variant="primary">Save</s-button>
        </s-stack>
      </s-box>
    );
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
                  {tab.id === "redeem-points-history"
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
