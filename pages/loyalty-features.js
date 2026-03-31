import { useEffect, useMemo, useState } from "react";
import { Page, LegacyCard, FormLayout, Checkbox, TextField, Button, Banner } from "@shopify/polaris";

const ui = {
  featureSectionTitle: {
    margin: "0 0 12px",
    fontSize: 16,
    fontWeight: 800,
    color: "#1f2a44",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  featureCard: {
    border: "1px solid #dfe5f5",
    borderRadius: 14,
    padding: "14px 16px",
    background: "#ffffff",
  },
  featureRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  featureCardTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#24324d",
  },
  featureCardDesc: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#6b7280",
  },
  labelSectionWrap: {
    marginTop: 10,
    paddingTop: 6,
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
    enableHistoryLabel: "",
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
          enableHistoryLabel: data.enable_history_label ?? "",
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

  const renderFeatureToggle = (label, description, checked, onChange) => (
    <div style={ui.featureCard}>
      <div style={ui.featureRow}>
        <div>
          <p style={ui.featureCardTitle}>{label}</p>
          <p style={ui.featureCardDesc}>{description}</p>
        </div>
        <div className="toggle-checkbox">
          <Checkbox label="" checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  );

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
    <Page title="Features">
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
          {renderFeatureToggle(
            "Loyalty Eligible",
            "Allow this store to use loyalty functionality across the app.",
            featuresConfig.loyaltyEligible,
            (value) => setFeaturesConfig((prev) => ({ ...prev, loyaltyEligible: value }))
          )}
          {renderFeatureToggle(
            "Product Sharing through Email",
            "Reward or enable product sharing by email from your loyalty flow.",
            featuresConfig.productSharingThroughEmail,
            (value) => setFeaturesConfig((prev) => ({ ...prev, productSharingThroughEmail: value }))
          )}
          {renderFeatureToggle(
            "Referral Code at Signup",
            "Enable referral code usage during customer signup.",
            featuresConfig.enableReferralCodeUseAtSignup,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enableReferralCodeUseAtSignup: value }))
          )}
          {renderFeatureToggle(
            "Login to See Points",
            "Require login before showing points-related loyalty information.",
            featuresConfig.loginToSeePoints,
            (value) => setFeaturesConfig((prev) => ({ ...prev, loginToSeePoints: value }))
          )}
          {renderFeatureToggle(
            "Redeem History",
            "Show customers their loyalty redemption history.",
            featuresConfig.enableRedeemHistory,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enableRedeemHistory: value }))
          )}
          {renderFeatureToggle(
            "Refer Friend",
            "Enable the referral program section for customers.",
            featuresConfig.enableReferFriend,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enableReferFriend: value }))
          )}
          {renderFeatureToggle(
            "Gift Certificate Generation",
            "Allow customers to convert points into gift cards.",
            featuresConfig.enableGiftCertificateGeneration,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enableGiftCertificateGeneration: value }))
          )}
          {renderFeatureToggle(
            "Tiers Information",
            "Show loyalty tier details and progress information.",
            featuresConfig.enableTiersInfo,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enableTiersInfo: value }))
          )}
          {renderFeatureToggle(
            "Profile Information",
            "Allow customers to update profile-based loyalty information.",
            featuresConfig.enableProfileInfo,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enableProfileInfo: value }))
          )}
          {renderFeatureToggle(
            "Redeem on Checkout",
            "Enable loyalty point redemption during checkout.",
            featuresConfig.enablePointsRedeemOnCheckout,
            (value) => setFeaturesConfig((prev) => ({ ...prev, enablePointsRedeemOnCheckout: value }))
          )}
        </div>

        <div style={ui.labelSectionWrap}>
          <h3 style={{ margin: "8px 0 12px", fontSize: 16, fontWeight: 700 }}>Label configuration</h3>
        </div>

        <FormLayout>

          <FormLayout.Group>
            <TextField
              label="My account tab heading"
              autoComplete="off"
              value={featuresConfig.myAccountTabHeading}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, myAccountTabHeading: value }))}
            />
            <TextField
              label="Enable history"
              autoComplete="off"
              value={featuresConfig.enableHistoryLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableHistoryLabel: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="Redeem history"
              autoComplete="off"
              value={featuresConfig.redeemHistoryLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, redeemHistoryLabel: value }))}
            />
            <TextField
              label="Refer friend"
              autoComplete="off"
              value={featuresConfig.referFriendLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, referFriendLabel: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="Gift card"
              autoComplete="off"
              value={featuresConfig.giftCardLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, giftCardLabel: value }))}
            />
            <TextField
              label="Tiers"
              autoComplete="off"
              value={featuresConfig.tiersLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, tiersLabel: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <TextField
              label="Update profile"
              autoComplete="off"
              value={featuresConfig.updateProfileLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, updateProfileLabel: value }))}
            />
            <TextField
              label="Product redeem"
              autoComplete="off"
              value={featuresConfig.productRedeemLabel}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, productRedeemLabel: value }))}
            />
          </FormLayout.Group>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={saveFeaturesConfig}>Save</Button>
          </div>
        </FormLayout>
      </LegacyCard>
      <style jsx global>{`
        .toggle-checkbox .Polaris-Choice {
          margin: 0;
        }

        .toggle-checkbox .Polaris-Choice__Control {
          margin: 0;
        }

        .toggle-checkbox .Polaris-Checkbox {
          width: 46px;
          min-width: 46px;
          height: 28px;
          position: relative;
        }

        .toggle-checkbox .Polaris-Checkbox__Input {
          width: 46px;
          height: 28px;
        }

        .toggle-checkbox .Polaris-Checkbox__Backdrop {
          inset: 0;
          border-radius: 999px;
          border: 1px solid #cfd8ee;
          background: #e9eef8;
        }

        .toggle-checkbox .Polaris-Checkbox__Icon {
          display: none;
        }

        .toggle-checkbox .Polaris-Checkbox::after {
          content: "";
          position: absolute;
          top: 4px;
          left: 4px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
          transition: transform 140ms ease;
          pointer-events: none;
        }

        .toggle-checkbox .Polaris-Checkbox__Input:checked + .Polaris-Checkbox__Backdrop {
          background: linear-gradient(120deg, #4f46e5, #0891b2);
          border-color: transparent;
        }

        .toggle-checkbox .Polaris-Checkbox:has(.Polaris-Checkbox__Input:checked)::after {
          transform: translateX(18px);
        }
      `}</style>
    </Page>
  );
}
