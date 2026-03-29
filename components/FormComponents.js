import { LegacyCard, FormLayout, TextField } from "@shopify/polaris";
import { useState } from "react";
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
    <LegacyCard>
      <LegacyCard.Section>
        <form onSubmit={handleSubmit}>
          <FormLayout>
            <TextField label="Auth Code" value={fields.authCode} onChange={handleChange("authCode")} autoComplete="off" />
            <TextField label="License Key" value={fields.licenseKey} onChange={handleChange("licenseKey")} autoComplete="off" />
            <TextField label="Product Code" value={fields.productCode} onChange={handleChange("productCode")} autoComplete="off" />
            <TextField label="Account ID" value={fields.accountId} onChange={handleChange("accountId")} autoComplete="off" />
            <TextField label="License URL" value={fields.licenseUrl} onChange={handleChange("licenseUrl")} autoComplete="off" />
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </FormLayout>
        </form>
      </LegacyCard.Section>
    </LegacyCard>
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
    <LegacyCard>
      <LegacyCard.Section>
        <form onSubmit={handleSubmit}>
          <FormLayout>
            <TextField label="Username" value={fields.username} onChange={handleChange("username")} autoComplete="off" />
            <TextField label="License Key" value={fields.licenseKey} onChange={handleChange("licenseKey")} autoComplete="off" />
            <TextField label="Product Code" value={fields.productCode} onChange={handleChange("productCode")} autoComplete="off" />
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </FormLayout>
        </form>
      </LegacyCard.Section>
    </LegacyCard>
  );
}
