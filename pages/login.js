import { useState, useEffect } from "react";
import { NetsuiteForm, LoyaltyForm } from "../components/FormComponents";
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

  const [selected, setSelected] = useState("loyalty");
  const [checkedLogin, setCheckedLogin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const report = window.__reportAppRenderState;
    if (typeof report !== "function") return;

    let state = "loading-login-check";
    let text = "Loading...";

    if (checkedLogin) {
      state = "login-form-visible";
      text =
        selected === "netsuite"
          ? "Login User Account / Existing NetSuite Customer"
          : "Login User Account / Existing Rental Customer";
    }

    report({
      page: "index",
      state,
      text,
      extra: `selected=${selected}`,
    });
  }, [checkedLogin, selected]);

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

  const hasNetsuiteForm = typeof NetsuiteForm === "function";
  const hasLoyaltyForm = typeof LoyaltyForm === "function";
  if ((selected === "netsuite" && !hasNetsuiteForm) || (selected === "loyalty" && !hasLoyaltyForm)) {
    return (
      <div style={{ padding: 20 }}>
        Unable to load login form component. Restart `shopify app dev` and hard refresh this page.
      </div>
    );
  }

  return (
    <div className={styles.pageBg}>
      <div className={styles.mainWrapper}>

        <h1 className={styles.loginTitle}>Login User Account</h1>

        <div className={styles.radioRow}>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="loginType"
              checked={selected === "netsuite"}
              onChange={() => setSelected("netsuite")}
            />
            Existing NetSuite Customer
          </label>

          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="loginType"
              checked={selected === "loyalty"}
              onChange={() => setSelected("loyalty")}
            />
            Existing Rental Customer
          </label>

        </div>

        {selected === "netsuite" && hasNetsuiteForm && <NetsuiteForm />}
        {selected === "loyalty" && hasLoyaltyForm && <LoyaltyForm />}

      </div>
    </div>
  );
}
