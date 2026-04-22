import { Button, LegacyCard, FormLayout, TextField } from "@shopify/polaris";
import { useState } from "react";
import styles from "../styles/Form.module.css";

function FieldIcon({ type }) {
  const paths = {
    shield: (
      <>
        <path d="M12 3 5 5.8v5.4c0 4.1 2.8 7.8 7 9.8 4.2-2 7-5.7 7-9.8V5.8L12 3Z" />
        <path d="m9.4 12 1.7 1.7 3.7-4" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="14" r="3.2" />
        <path d="m10.4 11.6 6.8-6.8" />
        <path d="m15.2 6.8 2 2" />
        <path d="m13.5 8.5 2 2" />
      </>
    ),
    cube: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5" />
        <path d="M12 12v9" />
        <path d="m8 5.3 8 4.5" />
      </>
    ),
    user: (
      <>
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </>
    ),
  };

  return (
    <span className={styles.fieldIcon}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {paths[type]}
      </svg>
    </span>
  );
}

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

export function NetsuiteForm() {
  const [fields, setFields] = useState({
    authCode: "",
    licenseKey: "",
    productCode: "",
    accountId: "",
    licenseUrl: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (value) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/netsuite-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || data?.error || "Login failed");
      } else {
        window.localStorage.setItem("lmpUser", JSON.stringify(data?.user || {}));
        const query = getEmbeddedQueryString();
        window.location.replace(`/dashboard${query || ""}`);
      }
    } catch (err) {
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginCard}>
      <LegacyCard>
        <LegacyCard.Section>
          <form onSubmit={handleSubmit}>
            <FormLayout>
              <TextField label="Auth Code" placeholder="Enter your auth code" value={fields.authCode} onChange={handleChange("authCode")} autoComplete="off" prefix={<FieldIcon type="shield" />} />
              <TextField label="License Key" placeholder="Enter your license key" value={fields.licenseKey} onChange={handleChange("licenseKey")} autoComplete="off" prefix={<FieldIcon type="key" />} />
              <TextField label="Product Code" placeholder="Enter your product code" value={fields.productCode} onChange={handleChange("productCode")} autoComplete="off" prefix={<FieldIcon type="cube" />} />
              <TextField label="Account ID" placeholder="Enter your account ID" value={fields.accountId} onChange={handleChange("accountId")} autoComplete="off" prefix={<FieldIcon type="user" />} />
              <TextField label="License URL" placeholder="Enter your license URL" value={fields.licenseUrl} onChange={handleChange("licenseUrl")} autoComplete="off" prefix={<FieldIcon type="globe" />} />
              <div className={styles.submitButton}>
                <Button submit variant="primary" loading={loading} fullWidth>
                  Login
                </Button>
              </div>
            </FormLayout>
          </form>
        </LegacyCard.Section>
      </LegacyCard>
    </div>
  );
}

export function LoyaltyForm() {
  const [fields, setFields] = useState({
    username: "",
    licenseKey: "",
    productCode: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (value) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/loyalty-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(fields),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || data?.error || "Login failed");
      } else {
        window.localStorage.setItem("lmpUser", JSON.stringify(data?.user || {}));
        const query = getEmbeddedQueryString();
        window.location.replace(`/dashboard${query || ""}`);
      }
    } catch (err) {
      alert("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginCard}>
      <LegacyCard>
        <LegacyCard.Section>
          <form onSubmit={handleSubmit}>
            <FormLayout>
              <TextField label="Username" placeholder="Enter your username" value={fields.username} onChange={handleChange("username")} autoComplete="off" prefix={<FieldIcon type="user" />} />
              <TextField label="License Key" placeholder="Enter your license key" value={fields.licenseKey} onChange={handleChange("licenseKey")} autoComplete="off" prefix={<FieldIcon type="key" />} />
              <TextField label="Product Code" placeholder="Enter your product code" value={fields.productCode} onChange={handleChange("productCode")} autoComplete="off" prefix={<FieldIcon type="cube" />} />
              <div className={styles.submitButton}>
                <Button submit variant="primary" loading={loading} fullWidth>
                  Login
                </Button>
              </div>
            </FormLayout>
          </form>
        </LegacyCard.Section>
      </LegacyCard>
    </div>
  );
}
