import { useEffect, useMemo, useState } from "react";
import { Page, LegacyCard, FormLayout, TextField, Button, Banner } from "@shopify/polaris";

function FeatureIcon({ kind }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const icons = {
    star: (
      <>
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m5 8 7 5 7-5" />
      </>
    ),
    login: (
      <>
        <circle cx="10" cy="10" r="4" />
        <path d="M21 21a8 8 0 0 0-8-8" />
        <path d="M16 8h5" />
        <path d="m18 6 3 2-3 2" />
      </>
    ),
    history: (
      <>
        <path d="M12 8v5l3 2" />
        <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
        <path d="M3 4v4h4" />
      </>
    ),
    gift: (
      <>
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M12 8v13" />
        <path d="M4 12h16" />
        <path d="M7.5 8a2.5 2.5 0 1 1 0-5c2 0 4.5 5 4.5 5S9.5 8 7.5 8Z" />
        <path d="M16.5 8a2.5 2.5 0 1 0 0-5c-2 0-4.5 5-4.5 5s2.5 0 4.5 0Z" />
      </>
    ),
    tiers: (
      <>
        <path d="M8 20h8" />
        <path d="M9 16h6" />
        <path d="M6 5h12v4a6 6 0 0 1-12 0Z" />
      </>
    ),
    cart: (
      <>
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="18" cy="19" r="1.5" />
        <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H7" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    referral: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M4 19a6 6 0 0 1 10 0" />
        <path d="M15 18a4.8 4.8 0 0 1 5 0" />
      </>
    ),
  };

  return <svg {...common}>{icons[kind] || icons.star}</svg>;
}

const ui = {
  pageShell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 0% 0%, rgba(111, 182, 143, 0.12), transparent 34%), radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.1), transparent 36%), linear-gradient(180deg, #f7fbf8 0%, #f7f7ff 100%)",
    padding: "24px 0 36px",
  },
  headerCard: {
    marginBottom: 16,
    padding: "20px 22px",
    borderRadius: 19,
    border: "1px solid #dfe7ef",
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,249,0.98) 100%)",
    boxShadow: "0 12px 26px rgba(15, 23, 42, 0.06)",
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    color: "#c0c8d4",
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#2d3748",
  },
  pageSubtitle: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#6b7280",
  },
  featureSectionTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 800,
    color: "#2f6f5d",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 18,
  },
  featureCard: {
    border: "1px solid #dfe7ef",
    borderRadius: 18,
    padding: "10px 14px",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfdfb 100%)",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
    overflow: "hidden",
  },
  featureRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 2px",
    borderBottom: "1px solid #ecf0f4",
  },
  featureRowLast: {
    borderBottom: "none",
  },
  featureLead: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
    flex: "1 1 auto",
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6a8a84",
    flexShrink: 0,
  },
  featureCardTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#355c54",
  },
  featureCardDesc: {
    margin: "4px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#7b8591",
  },
  toggleWrap: {
    flex: "0 0 52px",
    width: 52,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  toggleButton: {
    width: 58,
    height: 25,
    borderRadius: 999,
    border: "none",
    padding: 3,
    display: "inline-flex",
    alignItems: "center",
    cursor: "pointer",
    transition: "background 140ms ease",
  },
  toggleButtonOn: {
    background: "linear-gradient(120deg, #6fba87, #5aa472)",
    justifyContent: "flex-end",
  },
  toggleButtonOff: {
    background: "linear-gradient(120deg, #ef6b6b, #d94d4d)",
    justifyContent: "flex-start",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#ffffff",
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.16)",
    flexShrink: 0,
  },
  labelSectionWrap: {
    marginTop: 14,
    paddingTop: 8,
  },
  labelCard: {
    border: "1px solid #dfe7ef",
    borderRadius: 18,
    padding: "16px 16px 10px",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfdfb 100%)",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.05)",
  },
  labelGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  saveRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
};

function getEmbeddedQueryString() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const shopFromQuery = params.get("shop") || "";
  const shop = shopFromQuery || window.localStorage.getItem("shopify-shop-domain") || "";
  const scopedHostKey = shop ? `shopify-app-host:${shop}` : "";
  const hostFromQuery = params.get("host") || "";
  const host = hostFromQuery || (scopedHostKey ? window.localStorage.getItem(scopedHostKey) || "" : "");
  if (hostFromQuery && scopedHostKey) {
    window.localStorage.setItem(scopedHostKey, hostFromQuery);
  }

  const nextParams = new URLSearchParams();
  if (host) nextParams.set("host", host);
  if (shop) nextParams.set("shop", shop);
  const query = nextParams.toString();
  return query ? `?${query}` : "";
}

export default function LoyaltyFeaturesPage() {
  const [user, setUser] = useState(undefined);
  const [notice, setNotice] = useState({ tone: "success", message: "" });
  const [featuresConfig, setFeaturesConfig] = useState({
    loyaltyEligible: false,
    productSharingThroughEmail: false,
    enableReferralCodeUseAtSignup: false,
    loginToSeePoints: false,
    enableRedeemHistory: false,
    enableReferFriend: false,
    enableGiftCertificateGeneration: false,
    enableTiersInfo: false,
    enableProfileInfo: false,
    enablePointsRedeemOnCheckout: false,
    myAccountTabHeading: "",
    loyaltyPointsEarnedLabel: "",
    redeemHistoryLabel: "",
    referFriendLabel: "",
    giftCardLabel: "",
    tiersLabel: "",
    updateProfileLabel: "",
    productRedeemLabel: "",
  });

  useEffect(() => {
    const raw = sessionStorage.getItem("lmpUser") || localStorage.getItem("lmpUser");
    if (raw) {
      sessionStorage.setItem("lmpUser", raw);
      localStorage.setItem("lmpUser", raw);
    }
    setUser(raw ? JSON.parse(raw) : null);
  }, []);

  useEffect(() => {
    if (user === null) {
      window.location.replace(`/${getEmbeddedQueryString()}`);
    }
  }, [user]);

  useEffect(() => {
    async function loadFeaturesConfig() {
      try {
        const res = await fetch("/api/config/get-features");
        const data = await res.json();
        if (!data) return;

        setFeaturesConfig({
          loyaltyEligible: !!data.loyalty_eligible,
          productSharingThroughEmail: !!data.product_sharing_through_email,
          enableReferralCodeUseAtSignup: !!data.enable_referral_code_use_at_signup,
          loginToSeePoints: !!data.login_to_see_points,
          enableRedeemHistory: !!data.enable_redeem_history,
          enableReferFriend: !!data.enable_refer_friend,
          enableGiftCertificateGeneration: !!data.enable_gift_certificate_generation,
          enableTiersInfo: !!data.enable_tiers_info,
          enableProfileInfo: !!data.enable_profile_info,
          enablePointsRedeemOnCheckout: !!data.enable_points_redeem_on_checkout,
          myAccountTabHeading: data.my_account_tab_heading ?? "",
          loyaltyPointsEarnedLabel: data.loyalty_points_earned_label ?? "",
          redeemHistoryLabel: data.redeem_history_label ?? "",
          referFriendLabel: data.refer_friend_label ?? "",
          giftCardLabel: data.gift_card_label ?? "",
          tiersLabel: data.tiers_label ?? "",
          updateProfileLabel: data.update_profile_label ?? "",
          productRedeemLabel: data.product_redeem_label ?? "",
        });
      } catch (err) {
        console.error("Features config load error:", err);
      }
    }

    if (user) loadFeaturesConfig();
  }, [user]);

  useEffect(() => {
    if (!notice.message) return undefined;

    const timeoutId = window.setTimeout(() => {
      setNotice({ tone: "success", message: "" });
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const planEnd = useMemo(() => {
    if (!user?.planEnd) return null;
    const d = new Date(user.planEnd);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [user]);

  const isExpired = useMemo(() => {
    if (!planEnd) return false;
    return planEnd.getTime() < Date.now();
  }, [planEnd]);

  async function saveFeaturesConfig() {
    setNotice({ tone: "success", message: "" });
    try {
      const res = await fetch("/api/config/save-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(featuresConfig),
      });
      if (!res.ok) throw new Error("Failed to save features configuration");
      setNotice({ tone: "success", message: "Features configuration saved successfully." });
    } catch (err) {
      console.error("Save features config error:", err);
      setNotice({ tone: "critical", message: "Failed to save features configuration." });
    }
  }

  const leftFeatures = [
    ["Loyalty Eligible", "Allow this store to use loyalty functionality across the app.", "star", featuresConfig.loyaltyEligible, (value) => setFeaturesConfig((prev) => ({ ...prev, loyaltyEligible: value }))],
    ["Login to See Points", "Require login before showing points-based loyalty information.", "login", featuresConfig.loginToSeePoints, (value) => setFeaturesConfig((prev) => ({ ...prev, loginToSeePoints: value }))],
    ["Gift Certificate Generation", "Allow customers to convert points into gift certificates.", "gift", featuresConfig.enableGiftCertificateGeneration, (value) => setFeaturesConfig((prev) => ({ ...prev, enableGiftCertificateGeneration: value }))],
    ["Redeem on Checkout", "Enable loyalty point redemption during checkout.", "cart", featuresConfig.enablePointsRedeemOnCheckout, (value) => setFeaturesConfig((prev) => ({ ...prev, enablePointsRedeemOnCheckout: value }))],
    ["Referral Code at Signup", "Enable referral code usage during customer signup.", "config", featuresConfig.enableReferralCodeUseAtSignup, (value) => setFeaturesConfig((prev) => ({ ...prev, enableReferralCodeUseAtSignup: value }))],
  ];

  const rightFeatures = [
    ["Product Sharing through Email", "Reward or enable product sharing by email from your loyalty flow.", "mail", featuresConfig.productSharingThroughEmail, (value) => setFeaturesConfig((prev) => ({ ...prev, productSharingThroughEmail: value }))],
    ["Redeem History", "Show customers their loyalty redemption history.", "history", featuresConfig.enableRedeemHistory, (value) => setFeaturesConfig((prev) => ({ ...prev, enableRedeemHistory: value }))],
    ["Tiers Information", "Show loyalty tier detail and progress information.", "tiers", featuresConfig.enableTiersInfo, (value) => setFeaturesConfig((prev) => ({ ...prev, enableTiersInfo: value }))],
    ["Profile Information", "Allow customers to update profile-based loyalty information.", "profile", featuresConfig.enableProfileInfo, (value) => setFeaturesConfig((prev) => ({ ...prev, enableProfileInfo: value }))],
    ["Refer Friend", "Enable the referral program section for customers.", "referral", featuresConfig.enableReferFriend, (value) => setFeaturesConfig((prev) => ({ ...prev, enableReferFriend: value }))],
  ];

  const renderFeatureToggle = (item, index, items) => {
    const [label, description, icon, checked, onChange] = item;

    return (
      <div
        style={{
          ...ui.featureRow,
          ...(index === items.length - 1 ? ui.featureRowLast : {}),
        }}
      >
        <div style={ui.featureLead}>
          <div style={ui.featureIconWrap}>
            <FeatureIcon kind={icon} />
          </div>
          <div>
            <p style={ui.featureCardTitle}>{label}</p>
            {/* kept available for future use, but hidden for cleaner layout */}
          </div>
        </div>
        <div style={ui.toggleWrap}>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            style={{
              ...ui.toggleButton,
              ...(checked ? ui.toggleButtonOn : ui.toggleButtonOff),
            }}
            onClick={() => onChange(!checked)}
          >
            <span style={ui.toggleKnob} />
          </button>
        </div>
      </div>
    );
  };

  if (user === undefined) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!user) return <p style={{ padding: 20 }}>Redirecting...</p>;

  if (isExpired) {
    return (
      <Page title="Features">
        <LegacyCard sectioned>
          <Banner tone="critical">
            <p>Your license has expired. Please renew to access features configuration.</p>
          </Banner>
        </LegacyCard>
      </Page>
    );
  }

  return (
    <div style={ui.pageShell}>
    <Page title="Features">
      <div style={ui.headerCard}>
        <div style={ui.headerIconWrap}>
          <FeatureIcon kind="history" />
        </div>
        <div>
          <h1 style={ui.pageTitle}>NetScore Loyalty Rewards</h1>
          <p style={ui.pageSubtitle}>Manage loyalty features and labels to customize your rewards app.</p>
        </div>
      </div>

      <LegacyCard sectioned>
        {notice.message && (
          <div style={{ marginBottom: 12 }}>
            <Banner tone={notice.tone} onDismiss={() => setNotice({ tone: "success", message: "" })}>
              <p>{notice.message}</p>
            </Banner>
          </div>
        )}
        <div style={ui.featureSectionTitle}>Features configuration</div>
        <div style={ui.featureGrid}>
          <div style={ui.featureCard}>
            {leftFeatures.map((item, index) => renderFeatureToggle(item, index, leftFeatures))}
          </div>
          <div style={ui.featureCard}>
            {rightFeatures.map((item, index) => renderFeatureToggle(item, index, rightFeatures))}
          </div>
        </div>

        <div style={ui.labelCard}>
          <div style={ui.labelSectionWrap}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#2f6f5d" }}>Label configuration</h3>
            <p style={{ margin: "0 0 14px", color: "#7b8591", fontSize: 13 }}>Modify labels used within the rewards app.</p>
          </div>

          <FormLayout>
            <div className="loyalty-features-label-grid" style={ui.labelGrid}>
              <TextField
                label="My Account Tab Heading"
                autoComplete="off"
                value={featuresConfig.myAccountTabHeading}
                onChange={(value) =>
                  setFeaturesConfig((prev) => ({ ...prev, myAccountTabHeading: value }))
                }
              />

              <TextField
                label="Loyalty Points Earned"
                autoComplete="off"
                value={featuresConfig.loyaltyPointsEarnedLabel}
                onChange={(value) =>
                  setFeaturesConfig((prev) => ({ ...prev, loyaltyPointsEarnedLabel: value }))
                }
              />
              <TextField
                label="Redeem History"
                autoComplete="off"
                value={featuresConfig.redeemHistoryLabel}
                onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, redeemHistoryLabel: value }))}
              />

              <TextField
                label="Gift Card"
                autoComplete="off"
                value={featuresConfig.giftCardLabel}
                onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, giftCardLabel: value }))}
              />
              <TextField
                label="Refer Friend"
                autoComplete="off"
                value={featuresConfig.referFriendLabel}
                onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, referFriendLabel: value }))}
              />

              <TextField
                label="Update Profile"
                autoComplete="off"
                value={featuresConfig.updateProfileLabel}
                onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, updateProfileLabel: value }))}
              />
              <TextField
                label="Loyalty Tiers"
                autoComplete="off"
                value={featuresConfig.tiersLabel}
                onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, tiersLabel: value }))}
              />
            </div>

            <div style={ui.saveRow}>
              <Button variant="primary" onClick={saveFeaturesConfig}>Save</Button>
            </div>
          </FormLayout>
        </div>
      </LegacyCard>
      <style jsx global>{`
        .Polaris-Page {
          max-width: 1040px;
        }

        .Polaris-LegacyCard {
          border-radius: 20px;
          border: 1px solid #dfe7ef;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
          background: linear-gradient(180deg, #ffffff 0%, #fbfdfb 100%);
        }

        .Polaris-Banner {
          border-radius: 14px;
          border: 1px solid #dbe5f7;
        }

        .Polaris-TextField {
          border-radius: 12px;
          border-color: #d8e1e8;
          background: #ffffff;
        }

        .Polaris-TextField:focus-within {
          border-color: #68ae81;
          box-shadow: 0 0 0 2px rgba(104, 174, 129, 0.16);
        }

        .Polaris-Button--variantPrimary {
          background: linear-gradient(120deg, #67b17f, #4b9c67);
          border-color: transparent;
          box-shadow: none;
          border-radius: 10px;
        }

        .Polaris-Button--variantPrimary:hover {
          background: linear-gradient(120deg, #5aa472, #438f5e);
          border-color: transparent;
        }

        @media (max-width: 900px) {
          .Polaris-Page {
            max-width: 100%;
          }
        }

        @media (max-width: 768px) {
          .loyalty-features-label-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Page>
    </div>
  );
}
