import { useEffect, useMemo, useState } from "react";
import { Page, LegacyCard, FormLayout, Checkbox, TextField, Button, Banner } from "@shopify/polaris";

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
        <h3 style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700 }}>Features configuration</h3>


        <FormLayout>
          <FormLayout.Group>
            <Checkbox
              label="Loyalty Eligible"
              checked={featuresConfig.loyaltyEligible}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, loyaltyEligible: value }))}
            />
            <Checkbox
              label="Product Sharing through Email"
              checked={featuresConfig.productSharingThroughEmail}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, productSharingThroughEmail: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <Checkbox
              label="Enable referral code use at signup"
              checked={featuresConfig.enableReferralCodeUseAtSignup}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableReferralCodeUseAtSignup: value }))}
            />
            <Checkbox
              label="Login to see points"
              checked={featuresConfig.loginToSeePoints}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, loginToSeePoints: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <Checkbox
              label="Enable redeem history"
              checked={featuresConfig.enableRedeemHistory}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableRedeemHistory: value }))}
            />
            <Checkbox
              label="Enable refer friend"
              checked={featuresConfig.enableReferFriend}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableReferFriend: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <Checkbox
              label="Enable gift certificate generation"
              checked={featuresConfig.enableGiftCertificateGeneration}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableGiftCertificateGeneration: value }))}
            />
            <Checkbox
              label="Enable tiers info"
              checked={featuresConfig.enableTiersInfo}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableTiersInfo: value }))}
            />
          </FormLayout.Group>

          <FormLayout.Group>
            <Checkbox
              label="Enable profile info"
              checked={featuresConfig.enableProfileInfo}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enableProfileInfo: value }))}
            />
            <Checkbox
              label="Enable points redeem on checkout"
              checked={featuresConfig.enablePointsRedeemOnCheckout}
              onChange={(value) => setFeaturesConfig((prev) => ({ ...prev, enablePointsRedeemOnCheckout: value }))}
            />
          </FormLayout.Group>

          <h3 style={{ margin: "8px 0 0", fontSize: 16, fontWeight: 700 }}>Label configuration</h3>

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
    </Page>
  );
}
