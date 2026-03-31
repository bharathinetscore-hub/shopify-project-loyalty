import { useEffect, useMemo, useState } from "react";
import LoyaltyDashboard from "./loyalty-data";
import {
  Page,
  LegacyCard,
  FormLayout,
  TextField,
  Button,
  Banner,
  Badge,
  Checkbox,
} from "@shopify/polaris";

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

const ui = {
  shell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 0% 0%, rgba(125, 142, 255, 0.14), transparent 34%), radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.16), transparent 36%), linear-gradient(180deg, #f8fbff 0%, #f7f7ff 100%)",
    padding: "28px 0 40px",
  },
  hero: {
    borderRadius: 24,
    padding: "28px 30px 24px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(245,247,255,0.98) 100%)",
    color: "#25304d",
    border: "1px solid #dfe5fb",
    boxShadow: "0 18px 40px rgba(111, 127, 191, 0.18)",
    marginBottom: 18,
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "0.1px",
  },
  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  heroSub: {
    margin: "10px 0 16px",
    color: "#647091",
    fontSize: 15,
  },
  heroMetaRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid #dfe3f5",
    background: "#f5f7ff",
    color: "#55617f",
    fontSize: 13,
    fontWeight: 600,
  },
  heroLogoutBtn: {
    border: "1px solid #6674f2",
    background: "linear-gradient(135deg, #6a78ff 0%, #5d63ea 100%)",
    color: "#ffffff",
    borderRadius: 14,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(98, 108, 234, 0.28)",
  },
  panelWrap: {
    background: "transparent",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
    padding: 0,
    marginTop: 16,
  },
  dashboardSplit: {
    display: "grid",
    gridTemplateColumns: "270px 1fr",
    gap: 16,
    alignItems: "start",
  },
  sideNav: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,248,255,0.98) 100%)",
    border: "1px solid #dfe5fb",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 14px 32px rgba(111, 127, 191, 0.14)",
  },
  navList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  navButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    border: "1px solid transparent",
    background: "transparent",
    color: "#425074",
    padding: "14px 16px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "left",
  },
  navButtonActive: {
    background: "linear-gradient(135deg, #8c8fff 0%, #b39bff 100%)",
    color: "#ffffff",
    boxShadow: "0 12px 24px rgba(125, 112, 255, 0.24)",
  },
  navIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eef2ff",
    color: "#6370a1",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  navIconActive: {
    background: "rgba(255,255,255,0.18)",
    color: "#ffffff",
  },
  contentWrap: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,249,255,0.98) 100%)",
    border: "1px solid #dfe5fb",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 14px 32px rgba(111, 127, 191, 0.14)",
  },
  cardTitle: {
    margin: "0 0 6px",
    fontSize: 20,
    fontWeight: 800,
    color: "#23304f",
  },
  cardSubtitle: {
    margin: "0 0 14px",
    color: "#687591",
    fontSize: 14,
  },
  actionRow: {
    marginTop: 12,
    display: "flex",
    justifyContent: "flex-end",
  },
  tableHead: {
    textAlign: "left",
    padding: "13px 10px",
    fontSize: 12,
    letterSpacing: "0.25px",
    textTransform: "uppercase",
    color: "#57534e",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  tableCell: {
    padding: "11px 10px",
    borderBottom: "1px solid #edf2f7",
    verticalAlign: "top",
  },
  tierTableWrap: {
    overflowX: "auto",
    border: "1px solid #e1dbd2",
    borderRadius: 10,
    background: "#ffffff",
    boxShadow: "none",
  },
  tierActions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  userGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 10,
    marginTop: 4,
  },
  userField: {
    border: "1px solid #e2e7f7",
    borderRadius: 14,
    padding: "16px 18px",
    background: "#ffffff",
  },
  userLabel: {
    margin: 0,
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    letterSpacing: "0.2px",
    textTransform: "uppercase",
  },
  userValue: {
    margin: "4px 0 0",
    fontSize: 15,
    color: "#1f2937",
    fontWeight: 650,
    lineHeight: 1.15,
    wordBreak: "break-word",
  },
  userMetaRow: {
    marginTop: 12,
    border: "1px solid #e2e7f7",
    borderRadius: 14,
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    background: "#ffffff",
  },
  userMetaLabel: {
    color: "#475569",
    fontSize: 12,
    margin: 0,
  },
  userMetaDate: {
    margin: "2px 0 0",
    fontSize: 16,
    color: "#111827",
    fontWeight: 650,
  },
  alertWrap: {
    marginBottom: 16,
  },
};

export default function Dashboard() {
  const [routeReady, setRouteReady] = useState(false);
  const [isLoyaltyRoute, setIsLoyaltyRoute] = useState(false);
  const [user, setUser] = useState(undefined);
  const [activeTab, setActiveTab] = useState(0);

  const [appConfig, setAppConfig] = useState({
    signup: "",
    review: "",
    referral: "",
    birthday: "",
    anniversary: "",
  });

  const [pointsConfig, setPointsConfig] = useState({
    pointValue: "",
    equivalent: "",
    pointsExpiry: "",
    giftcardExpiry: "",
    netsuiteEndpoint: "",
  });

  const [threshold, setThreshold] = useState("");

  const [social, setSocial] = useState({
    email: "",
    facebook: "",
  });
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

  const [tiers, setTiers] = useState([
    {
      id: null,
      name: "",
      threshold: "",
      points: "",
      level: "",
      active: true,
    },
  ]);

  const [notice, setNotice] = useState({ tone: "success", message: "" });

  const expiry = useMemo(() => {
    if (!user?.planEnd) return null;
    return new Date(user.planEnd);
  }, [user]);

  const formattedExpiry = useMemo(() => {
    if (!expiry || Number.isNaN(expiry.getTime())) return "-";
    return expiry.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, [expiry]);

  const daysLeft = useMemo(() => {
    if (!expiry) return null;
    const today = new Date();
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  }, [expiry]);

  const isExpired = typeof daysLeft === "number" && daysLeft < 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const report = window.__reportAppRenderState;
    if (typeof report !== "function") return;

    let state = "dashboard-loading-route";
    let text = "Loading...";
    let extra = `activeTab=${activeTab}`;

    if (routeReady && isLoyaltyRoute) {
      state = "loyalty-subroute";
      text = "Loyalty dashboard subroute";
    } else if (routeReady && user === undefined) {
      state = "dashboard-loading-user";
      text = "Loading...";
    } else if (routeReady && !user) {
      state = "dashboard-redirecting";
      text = "Redirecting...";
    } else if (routeReady && isExpired) {
      state = "dashboard-license-expired";
      text = "Loyalty Rewards SetUp / License expired";
      extra = `${extra} daysLeft=${daysLeft}`;
    } else if (routeReady && user) {
      state = "dashboard-visible";
      text = "Loyalty Rewards SetUp";
      extra = `${extra} userType=${user.type || ""} notice=${notice.message || ""}`;
    }

    report({
      page: "dashboard",
      state,
      text,
      extra,
    });
  }, [routeReady, isLoyaltyRoute, user, isExpired, daysLeft, activeTab, notice.message]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = window.location.pathname;
    const searchTab = new URLSearchParams(window.location.search).get("tab");

    if (searchTab === "customers" || searchTab === "events" || searchTab === "items" || searchTab === "giftcard-generated" || searchTab === "loyalty-config") {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    if (path.includes("/loyalty-data")) {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    if (path.includes("/loyalty-events")) {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    if (path.includes("/loyalty-items")) {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    if (path.includes("/loyalty-giftcard-generated")) {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    if (path.includes("/loyalty-customers")) {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    if (path.includes("/loyalty-config")) {
      setIsLoyaltyRoute(true);
      setRouteReady(true);
      return;
    }

    setRouteReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const configTab = (params.get("configTab") || "").toLowerCase();
    const configTabIndexMap = {
      user: 0,
      app: 1,
      points: 2,
      threshold: 3,
      features: 4,
      tiers: 5,
    };
    if (configTab && configTabIndexMap[configTab] !== undefined) {
      setActiveTab(configTabIndexMap[configTab]);
    }
  }, []);

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
    const query = getEmbeddedQueryString();
    window.location.replace(`/login${query}`);
  }
}, [user]);

  useEffect(() => {
    async function refreshUserFromDb() {
      if (!user?.licenseKey || !user?.type) return;

      try {
        const res = await fetch("/api/auth/refresh-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: user.type,
            licenseKey: user.licenseKey,
            username: user.username,
            productCode: user.productCode,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!data?.success || !data.user) return;

        const merged = { ...user, ...data.user };
        setUser(merged);
        sessionStorage.setItem("lmpUser", JSON.stringify(merged));
        localStorage.setItem("lmpUser", JSON.stringify(merged));
      } catch (err) {
        console.error("User refresh error:", err);
      }
    }

    if (user) {
      refreshUserFromDb();
    }
  }, [user?.type, user?.licenseKey, user?.username, user?.productCode]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/config/get-config");
        const data = await res.json();

        if (!data) return;

        setAppConfig({
          signup: data.customer_signup_points ?? "",
          review: data.product_review_points ?? "",
          referral: data.referral_points ?? "",
          birthday: data.birthday_points ?? "",
          anniversary: data.anniversary_points ?? "",
        });

        setPointsConfig({
          pointValue: data.each_point_value ?? "",
          equivalent: data.loyalty_point_value ?? "",
          pointsExpiry: data.points_expiration_days ?? "",
          giftcardExpiry: data.giftcard_expiry_days ?? "",
          netsuiteEndpoint: data.netsuite_endpoint_url ?? "",
        });

        setThreshold(data.minimum_redemption_points ?? "");

        setSocial({
          email: data.email_share_points ?? "",
          facebook: data.facebook_share_points ?? "",
        });
      } catch (err) {
        console.error("Config load error:", err);
      }
    }

    if (user) loadConfig();
  }, [user]);

  useEffect(() => {
    async function loadTiers() {
      try {
        const res = await fetch("/api/tiers/get-tiers");
        const data = await res.json();

        if (!data || data.length === 0) return;

        setTiers(
          data.map((tier) => ({
            id: tier.id,
            name: tier.tier_name,
            threshold: tier.threshold,
            points: tier.points_per_dollar ?? "",
            level: tier.level,
            active: tier.status,
          }))
        );
      } catch (err) {
        console.error("Tier load error:", err);
      }
    }

    if (user) loadTiers();
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

  const nextTierLevel = useMemo(() => {
    const maxLevel = tiers.reduce((max, tier) => {
      const parsed = Number(tier.level);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    return maxLevel + 1;
  }, [tiers]);

  const tabs = [
    { id: "user", content: "User Details", panelID: "user-panel" },
    { id: "app", content: "App Config", panelID: "app-panel" },
    { id: "points", content: "Points Config", panelID: "points-panel" },
    { id: "threshold", content: "Threshold", panelID: "threshold-panel" },
    // { id: "social", content: "Social Share", panelID: "social-panel" },
    { id: "tiers", content: "Loyalty Tiers", panelID: "tiers-panel" },
  ];

  const showNotice = (message, tone = "success") => {
    setNotice({ message, tone });
  };

  const clearNotice = () => {
    setNotice({ message: "", tone: "success" });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("lmpUser");
    localStorage.removeItem("lmpUser");
    setUser(null);
    window.location.replace(`/login${getEmbeddedQueryString()}`);
    // window.location.replace(`/${getEmbeddedQueryString()}`);
  };

  const saveAllConfig = async () => {
    clearNotice();

    try {
      const res = await fetch("/api/config/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...appConfig,
          ...pointsConfig,
          threshold,
          ...social,
        }),
      });

      if (!res.ok) throw new Error("Failed to save configuration");
      showNotice("Configuration saved successfully.", "success");
    } catch (err) {
      console.error("Save config error:", err);
      showNotice("Failed to save configuration.", "critical");
    }
  };

  const saveFeaturesConfig = async () => {
    clearNotice();

    try {
      const res = await fetch("/api/config/save-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(featuresConfig),
      });

      if (!res.ok) throw new Error("Failed to save features configuration");
      showNotice("Features configuration saved successfully.", "success");
    } catch (err) {
      console.error("Save features config error:", err);
      showNotice("Failed to save features configuration.", "critical");
    }
  };

  const addTier = () => {
    setTiers((prev) => {
      const lastTier = prev[prev.length - 1];
      if (lastTier?.isNew) {
        return prev.slice(0, -1);
      }

      return [
        ...prev,
        {
          id: null,
          name: "",
          threshold: "",
          points: "",
          level: "",
          active: true,
          isNew: true,
        },
      ];
    });
  };

  const updateTier = (index, field, value) => {
    const updated = [...tiers];
    updated[index][field] = value;
    setTiers(updated);
  };

  const saveTiers = async () => {
    clearNotice();

    try {
      const res = await fetch("/api/tiers/save-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiers: tiers.map(({ isNew, ...tier }) => tier),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error("Failed to save tiers");
      setTiers((prev) => prev.map(({ isNew, ...tier }) => tier));
      showNotice("Loyalty tiers saved successfully.", "success");
    } catch (err) {
      console.error("Save tiers error:", err);
      showNotice("Failed to save loyalty tiers.", "critical");
    }
  };

  if (!routeReady) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  if (isLoyaltyRoute) {
    return <LoyaltyDashboard />;
  }

  if (user === undefined) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  if (!user) {
    return <p style={{ padding: 20 }}>Redirecting...</p>;
  }

  if (isExpired) {
    return (
      <div style={ui.shell} className="dashboard-shell">
        <div className="dashboard-frame">
          <Page>
            <div style={ui.hero}>
              <div style={ui.heroTopRow}>
                <h2 style={ui.heroTitle}>Loyalty Rewards SetUp</h2>
                <button type="button" style={ui.heroLogoutBtn} onClick={handleLogout}>
                  Logout
                </button>
              </div>
              <p style={ui.heroSub}>License has expired. Configuration tabs are disabled.</p>
            </div>
            <Banner tone="critical">
              <p>
                License expired on {formattedExpiry}. Please renew your license to access tabs and settings.
              </p>
            </Banner>
          </Page>
        </div>
      </div>
    );
  }

  const userPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>User Details</h2>
      <p style={ui.cardSubtitle}>License, identity, and subscription context for this store.</p>
      <div style={ui.userGrid}>
        {user.type === "netsuite" && (
          <>
            {/* <div style={ui.userField}>
              <p style={ui.userLabel}>Auth Code</p>
              <p style={ui.userValue}>{user.authCode || "-"}</p>
            </div> */}
            <div style={ui.userField}>
              <p style={ui.userLabel}>Product Code</p>
              <p style={ui.userValue}>{user.productCode || "-"}</p>
            </div>
            <div style={ui.userField}>
              <p style={ui.userLabel}>Account ID</p>
              <p style={ui.userValue}>{user.accountId || "-"}</p>
            </div>
            {/* <div style={ui.userField}>
              <p style={ui.userLabel}>License URL</p>
              <p style={ui.userValue}>{user.licenseUrl || "-"}</p>
            </div> */}
          </>
        )}
        <div style={ui.userField}>
          <p style={ui.userLabel}>License Key</p>
          <p style={ui.userValue}>{user.licenseKey || "-"}</p>
        </div>

        {user.type === "loyalty" && (
          <div style={ui.userField}>
            <p style={ui.userLabel}>Username</p>
            <p style={ui.userValue}>{user.username || "-"}</p>
          </div>
        )}
      </div>

      <div style={ui.userMetaRow}>
        <div>
          <p style={ui.userMetaLabel}>Licence Expiry Date</p>
          <p style={ui.userMetaDate}>{formattedExpiry}</p>
        </div>
          {typeof daysLeft === "number" && (
            <Badge tone={isExpired ? "critical" : daysLeft < 30 ? "critical" : "success"}>
              {isExpired ? "Expired" : `${daysLeft} days left`}
            </Badge>
          )}
      </div>
    </LegacyCard>
  );

  const appPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>App Configurations</h2>
      <p style={ui.cardSubtitle}>Set reward points granted for core customer actions.</p>
      <FormLayout>
        <FormLayout.Group>
          <TextField label="Signup Points" type="number" autoComplete="off" value={appConfig.signup} onChange={(value) => setAppConfig({ ...appConfig, signup: value })} />
          <TextField label="Review Points" type="number" autoComplete="off" value={appConfig.review} onChange={(value) => setAppConfig({ ...appConfig, review: value })} />
        </FormLayout.Group>
        <FormLayout.Group>
          <TextField label="Referral Points" type="number" autoComplete="off" value={appConfig.referral} onChange={(value) => setAppConfig({ ...appConfig, referral: value })} />
          <TextField label="Birthday Points" type="number" autoComplete="off" value={appConfig.birthday} onChange={(value) => setAppConfig({ ...appConfig, birthday: value })} />
        </FormLayout.Group>
        <FormLayout.Group>
          <TextField label="Anniversary Points" type="number" autoComplete="off" value={appConfig.anniversary} onChange={(value) => setAppConfig({ ...appConfig, anniversary: value })} />
          <div />
        </FormLayout.Group>
        <div style={ui.actionRow}>
          <Button variant="primary" onClick={saveAllConfig}>Save</Button>
        </div>
      </FormLayout>
    </LegacyCard>
  );

  const pointsPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>Points Configuration</h2>
      <p style={ui.cardSubtitle}>Define how points map to value and expiration policy.</p>
      <FormLayout>
        <FormLayout.Group>
          <TextField
            label="Point Value"
            type="number"
            autoComplete="off"
            value={pointsConfig.pointValue}
            helpText="Points Earn on Every One Dollar"
            onChange={(value) => setPointsConfig({ ...pointsConfig, pointValue: value })}
          />

          <TextField
            label="Loyalty Point Equivalent"
            type="number"
            autoComplete="off"
            value={pointsConfig.equivalent}
            helpText="Points Value in One Doller"
            onChange={(value) => setPointsConfig({ ...pointsConfig, equivalent: value })}
          />
        </FormLayout.Group>

        <FormLayout.Group>
          <TextField
            label="Points Expiration Days"
            type="number"
            autoComplete="off"
            value={pointsConfig.pointsExpiry}
            helpText="Leave empty for no expiration."
            onChange={(value) => setPointsConfig({ ...pointsConfig, pointsExpiry: value })}
          />

          <TextField
            label="Giftcard Expiry Days"
            type="number"
            autoComplete="off"
            value={pointsConfig.giftcardExpiry}
            helpText="Leave empty for no expiry."
            onChange={(value) => setPointsConfig({ ...pointsConfig, giftcardExpiry: value })}
          />
        </FormLayout.Group>

        <FormLayout.Group>
          <TextField
            label="NetSuite Endpoint URL"
            type="url"
            autoComplete="off"
            value={pointsConfig.netsuiteEndpoint}
            helpText="Single NetSuite endpoint used to send Gift Card and Order data."
            onChange={(value) => setPointsConfig({ ...pointsConfig, netsuiteEndpoint: value })}
          />
          <div />
        </FormLayout.Group>

        <div style={ui.actionRow}>
          <Button variant="primary" onClick={saveAllConfig}>Save</Button>
        </div>
      </FormLayout>
    </LegacyCard>
  );

  const thresholdPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>Threshold Configuration</h2>
      <p style={ui.cardSubtitle}>Set the minimum points required for redemption eligibility.</p>
      <FormLayout>
        <FormLayout.Group>
          <TextField
            label="Minimum Redemption Points"
            type="number"
            autoComplete="off"
            value={threshold}
            onChange={setThreshold}
          />
          <div />
        </FormLayout.Group>
        <div style={ui.actionRow}>
          <Button variant="primary" onClick={saveAllConfig}>Save</Button>
        </div>
      </FormLayout>
    </LegacyCard>
  );

  const socialPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>Social Share Configuration</h2>
      <p style={ui.cardSubtitle}>Reward customers for social engagement activity.</p>
      <FormLayout>
        <FormLayout.Group>
          <TextField
            label="Email Share Points"
            type="number"
            autoComplete="off"
            value={social.email}
            onChange={(value) => setSocial({ ...social, email: value })}
          />

          <TextField
            label="Facebook Share Points"
            type="number"
            autoComplete="off"
            value={social.facebook}
            onChange={(value) => setSocial({ ...social, facebook: value })}
          />
        </FormLayout.Group>

        <div style={ui.actionRow}>
          <Button variant="primary" onClick={saveAllConfig}>Save</Button>
        </div>
      </FormLayout>
    </LegacyCard>
  );

  const featuresPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>Features</h2>
      <p style={ui.cardSubtitle}>Enable or disable storefront loyalty features and configure labels.</p>
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

        <div style={ui.actionRow}>
          <Button variant="primary" onClick={saveFeaturesConfig}>Save</Button>
        </div>
      </FormLayout>
    </LegacyCard>
  );

  const tiersPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.cardTitle}>Loyalty Tiers</h2>
      <p style={ui.cardSubtitle}>Manage threshold strategy and point multipliers across loyalty levels.</p>

      <div style={ui.tierTableWrap}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={ui.tableHead}>Tier Name</th>
              <th style={ui.tableHead}>Threshold</th>
              <th style={ui.tableHead}>Points (per $)</th>
              <th style={ui.tableHead}>Level</th>
              <th style={{ ...ui.tableHead, textAlign: "center" }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => (
              <tr key={index}>
                <td style={ui.tableCell}>
                  <TextField
                    labelHidden
                    label={`Tier Name ${index + 1}`}
                    autoComplete="off"
                    value={tier.name}
                    onChange={(value) => updateTier(index, "name", value)}
                  />
                </td>
                <td style={ui.tableCell}>
                  <TextField
                    labelHidden
                    label={`Threshold ${index + 1}`}
                    type="number"
                    autoComplete="off"
                    value={String(tier.threshold)}
                    onChange={(value) => updateTier(index, "threshold", value)}
                  />
                </td>
                <td style={ui.tableCell}>
                  <TextField
                    labelHidden
                    label={`Points ${index + 1}`}
                    type="number"
                    autoComplete="off"
                    value={String(tier.points)}
                    onChange={(value) => updateTier(index, "points", value)}
                  />
                </td>
                <td style={ui.tableCell}>
                  <TextField
                    labelHidden
                    label={`Level ${index + 1}`}
                    autoComplete="off"
                    value={
                      tier.level === "" || tier.level === null || tier.level === undefined
                        ? String(nextTierLevel)
                        : String(tier.level)
                    }
                    readOnly
                  />
                </td>
                <td style={{ ...ui.tableCell, textAlign: "center" }}>
                  <Checkbox
                    label=""
                    checked={!!tier.active}
                    onChange={(value) => updateTier(index, "active", value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={ui.tierActions}>
        <Button onClick={addTier}>
          {tiers[tiers.length - 1]?.isNew ? "Hide Tier" : "Add Tier"}
        </Button>
        <Button variant="primary" onClick={saveTiers}>Save</Button>
      </div>
    </LegacyCard>
  );

  // Order must match `tabs` above so the right content shows per tab
  const panels = [userPanel, appPanel, pointsPanel, thresholdPanel, tiersPanel];
  const currentTab = tabs[activeTab] || tabs[0];

  return (
    <div style={ui.shell} className="dashboard-shell">
      <div className="dashboard-frame">
        <Page
        >
          <div style={ui.hero}>
            <div style={ui.heroTopRow}>
              <h2 style={ui.heroTitle}>Loyalty Rewards SetUp</h2>
              <button type="button" style={ui.heroLogoutBtn} onClick={handleLogout}>
                Logout
              </button>
            </div>
            <p style={ui.heroSub}>
              Centralized configuration for rewards, thresholds, point value strategy, and tier progression.
            </p>
            <div style={ui.heroMetaRow}>
              <span style={ui.pill}>Mode: {user.type || "standard"}</span>
              <span style={ui.pill}>License: {(user.licenseKey || "-").slice(0, 14)}...</span>
              {typeof daysLeft === "number" && (
                <span style={ui.pill}>
                  {isExpired ? "License expired" : `Expires in ${daysLeft} days`}
                </span>
              )}
            </div>
          </div>

          {notice.message && (
            <div style={ui.alertWrap}>
              <Banner tone={notice.tone} onDismiss={clearNotice}>
                <p>{notice.message}</p>
              </Banner>
            </div>
          )}

          {typeof daysLeft === "number" && (
            <div style={ui.alertWrap}>
              <Banner tone={isExpired ? "critical" : daysLeft < 30 ? "critical" : "success"}>
                <p>
                  {isExpired
                    ? "License expired. Please renew it as soon as possible."
                    : `Your license expires in ${daysLeft} day(s).`}
                </p>
              </Banner>
            </div>
          )}

          <div style={ui.panelWrap}>
            <div style={ui.dashboardSplit}>
              <div style={ui.sideNav}>
                <div style={ui.navList}>
                  {tabs.map((tab, index) => {
                    const isActive = index === activeTab;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        style={{
                          ...ui.navButton,
                          ...(isActive ? ui.navButtonActive : {}),
                        }}
                        onClick={() => setActiveTab(index)}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              ...ui.navIcon,
                              ...(isActive ? ui.navIconActive : {}),
                            }}
                          >
                            {tab.content
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <span>{tab.content}</span>
                        </span>
                        <span>{">"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={ui.contentWrap}>
                <div style={{ marginBottom: 18 }}>
                  <h2 style={ui.cardTitle}>{currentTab.content}</h2>
                  <p style={ui.cardSubtitle}>
                    {currentTab.id === "user"
                      ? "License, identity, and subscription context for this store."
                      : currentTab.id === "app"
                        ? "Set reward points granted for core customer actions."
                        : currentTab.id === "points"
                          ? "Define point value, equivalence, and expiry policy."
                          : currentTab.id === "threshold"
                            ? "Set the minimum points required for redemption eligibility."
                            : "Manage threshold strategy and point multipliers across loyalty levels."}
                  </p>
                </div>
                <div>{panels[activeTab]}</div>
              </div>
            </div>
          </div>
        <style jsx global>{`
          :root {
            --dash-brand-primary: #4f46e5;
            --dash-brand-secondary: #0891b2;
            --dash-tab-active-start: #4f46e5;
            --dash-tab-active-end: #0891b2;
            --dash-ink: #1f2937;
            --dash-subtle-ink: #4b5563;
            --dash-border: #d5def0;
            --dash-font: "Segoe UI", "Inter", Arial, sans-serif;
          }

          .dashboard-shell,
          .dashboard-shell * {
            font-family: var(--dash-font);
          }

          .dashboard-frame {
            animation: none;
          }

          .Polaris-Page {
            max-width: 1140px;
          }

          .Polaris-Page-Header {
            background: #effbff;
            border: 1px solid #d9e0f3;
            border-radius: 10px;
            padding: 12px 14px;
          }

          .Polaris-Page-Header__Title {
            color: var(--dash-ink);
            letter-spacing: 0.2px;
          }

          .Polaris-LegacyCard {
            border: 1px solid #e1e7f7;
            border-radius: 18px;
            box-shadow: none;
          }

          .Polaris-TextField {
            border-radius: 12px;
            border-color: #dfe5f5;
            background: #ffffff;
            transition: border-color 120ms ease, box-shadow 120ms ease;
          }

          .Polaris-TextField:hover {
            border-color: #c1cedf;
          }

          .Polaris-TextField:focus-within {
            border-color: var(--dash-brand-primary);
            box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.18);
          }

          .Polaris-TextField__Input {
            font-size: 14px;
            font-weight: 500;
            color: var(--dash-ink);
          }

          .Polaris-Label__Text {
            font-weight: 600;
            color: var(--dash-ink);
          }

          .Polaris-Connected {
            border-radius: 8px;
          }

          .Polaris-Button--variantPrimary {
            background: var(--dash-brand-primary);
            border-color: transparent;
            box-shadow: 0 8px 16px rgba(79, 70, 229, 0.26);
          }

          .Polaris-Button--variantPrimary:hover {
            background: #4338ca;
            border-color: transparent;
          }

          .Polaris-Button--variantSecondary {
            border-color: #cdd7ed;
            color: #44403c;
            background: #ffffff;
          }

          .Polaris-Banner {
            border-radius: 18px;
            border: 1px solid #dfe7f8;
            background: linear-gradient(180deg, #ffffff, #f8fbff);
            box-shadow: 0 12px 28px rgba(111, 127, 191, 0.12);
          }

          .Polaris-Checkbox__Input:checked + .Polaris-Checkbox__Backdrop {
            background: linear-gradient(120deg, var(--dash-brand-primary), var(--dash-brand-secondary));
            border-color: transparent;
          }

          @media (max-width: 740px) {
            .Polaris-Page {
              padding-inline: 10px;
            }

            .Polaris-Page-Header {
              padding: 12px;
            }
          }
        `}</style>
        </Page>
      </div>
    </div>
  );
}
