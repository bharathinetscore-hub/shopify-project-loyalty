import { useEffect, useState } from "react";
import { UnifiedLoginForm } from "../components/FormComponents";
import styles from "../styles/Form.module.css";

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

export default function Home() {

  const [checkedLogin, setCheckedLogin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const report = window.__reportAppRenderState;
    if (typeof report !== "function") return;

    let state = "loading-login-check";
    let text = "Loading...";

    if (checkedLogin) {
      state = "login-form-visible";
      text = "Login User Account";
    }

    report({
      page: "index",
      state,
      text,
      extra: "mode=single-form",
    });
  }, [checkedLogin]);

  useEffect(() => {
    const user = sessionStorage.getItem("lmpUser") || localStorage.getItem("lmpUser");

    if (user) {
      sessionStorage.setItem("lmpUser", user);
      const query = getEmbeddedQueryString();
      // Only redirect if NOT already heading to dashboard to prevent loops
      if (!window.location.pathname.includes('/dashboard')) {
        if (typeof window.__reportAppRenderState === "function") {
          window.__reportAppRenderState({
            page: "index",
            state: "redirect-dashboard",
            text: "Redirecting to dashboard",
            extra: `hasUser=1 query=${query}`,
          });
        }
        window.location.replace(`/dashboard${query}`);
      }
    } else {
      setCheckedLogin(true);
    }
  }, []);

  // ⛔ Wait until login check finishes
  if (!checkedLogin) return <div>Loading...</div>;

  const hasUnifiedLoginForm = typeof UnifiedLoginForm === "function";
  if (!hasUnifiedLoginForm) {
    return (
      <div style={{ padding: 20 }}>
        Unable to load login form component. Restart `shopify app dev` and hard refresh this page.
      </div>
    );
  }

  return (
    <div className={styles.pageBg}>
      <div className={styles.mainWrapper}>
        <div className={styles.brandPanel} aria-hidden="true">
          <div className={styles.giftHalo}>
            <svg className={styles.giftIcon} viewBox="0 0 120 120" role="img">
              <path d="M24 45h72v16H24z" />
              <path d="M31 61h58v39H31z" />
              <path d="M58 45v55" />
              <path d="M60 44c-13-3-25-13-18-23 8-12 20 5 18 23Z" />
              <path d="M60 44c13-3 25-13 18-23-8-12-20 5-18 23Z" />
              <circle cx="86" cy="78" r="18" />
              <path className={styles.starPath} d="m86 67 3.5 7 7.7 1.1-5.6 5.5 1.3 7.7-6.9-3.6-6.9 3.6 1.3-7.7-5.6-5.5 7.7-1.1Z" />
            </svg>
          </div>

          <div className={styles.brandText}>
            <h2>NetScore</h2>
            <p>Loyalty Rewards</p>
            <span />
            <div>
              Reward customers.<br />
              Build loyalty.<br />
              Grow your business.
            </div>
          </div>

          <div className={styles.analyticsCard}>
            <div className={styles.cardTopLine} />
            <div className={styles.cardMutedLine} />
            <div className={styles.chartRow}>
              <div className={styles.pieChart} />
              <div className={styles.statBars}>
                <i />
                <i />
                <i />
              </div>
              <div className={styles.lockCircle}>
                <svg viewBox="0 0 24 24">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M12 15v2" />
                </svg>
              </div>
            </div>
          </div>

          <div className={`${styles.dotGrid} ${styles.dotGridLeft}`} />
        </div>

        <div className={styles.formPanel}>
          <div className={`${styles.dotGrid} ${styles.dotGridRight}`} />
          <div className={styles.loginHeader}>
            <h1 className={styles.loginTitle}>Activate Your Licence</h1>
            <p>Fill the licence details</p>
          </div>

          <div className={styles.formShell}>
            {hasUnifiedLoginForm && <UnifiedLoginForm />}
          </div>
        </div>
      </div>
    </div>
  );
}
