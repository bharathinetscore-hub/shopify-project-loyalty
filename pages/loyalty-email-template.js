import { useEffect, useMemo, useState } from "react";
import { Page, LegacyCard, FormLayout, TextField, Button, Banner, Tabs } from "@shopify/polaris";
import { EMAIL_TEMPLATE_KEYS } from "../lib/email-template-definitions";

const TEMPLATE_ORDER = [
  EMAIL_TEMPLATE_KEYS.REFER_FRIEND,
  EMAIL_TEMPLATE_KEYS.GIFT_CARD,
  EMAIL_TEMPLATE_KEYS.POINTS_EARNED,
  EMAIL_TEMPLATE_KEYS.POINTS_REDEEMED,
];

const TEMPLATE_LABELS = {
  [EMAIL_TEMPLATE_KEYS.REFER_FRIEND]: {
    title: "Refer Friend",
    description: "Customize the email shared when a customer sends their referral code.",
  },
  [EMAIL_TEMPLATE_KEYS.GIFT_CARD]: {
    title: "Generate Giftcard",
    description: "Customize the email sent when a gift card coupon is generated.",
  },
  [EMAIL_TEMPLATE_KEYS.POINTS_EARNED]: {
    title: "Points Earned",
    description: "Customize the email sent when a customer receives loyalty points.",
  },
  [EMAIL_TEMPLATE_KEYS.POINTS_REDEEMED]: {
    title: "Points Redeemed",
    description: "Customize the email sent when a customer spends loyalty points.",
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

const ui = {
  shell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 0% 0%, rgba(13, 148, 136, 0.12), transparent 34%), radial-gradient(circle at 100% 0%, rgba(37, 99, 235, 0.1), transparent 36%), linear-gradient(180deg, #f7fbff 0%, #fbfcff 100%)",
    padding: "24px 0 36px",
  },
  hero: {
    marginBottom: 16,
    padding: "22px 24px",
    borderRadius: 20,
    border: "1px solid #dce7f4",
    background: "linear-gradient(135deg, #0f766e 0%, #2563eb 100%)",
    color: "#ffffff",
    boxShadow: "0 16px 34px rgba(15, 23, 42, 0.12)",
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  heroSub: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#183153",
  },
  cardSub: {
    margin: "6px 0 14px",
    fontSize: 13,
    color: "#64748b",
  },
  templateStack: {
    display: "grid",
    gap: 16,
  },
  helperWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 6,
    marginBottom: 10,
  },
  helperPill: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eef6ff",
    border: "1px solid #cfe0fb",
    color: "#21456d",
    fontSize: 12,
    fontWeight: 700,
  },
  saveRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 16,
  },
};

export default function LoyaltyEmailTemplatePage() {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ tone: "success", message: "" });
  const [templates, setTemplates] = useState({});
  const [activeTab, setActiveTab] = useState(0);

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
    async function loadTemplates() {
      try {
        const res = await fetch("/api/config/get-email-templates");
        const data = await res.json();
        setTemplates(data?.templates || {});
      } catch (error) {
        console.error("load email templates error:", error);
        setNotice({ tone: "critical", message: "Failed to load email templates." });
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadTemplates();
    }
  }, [user]);

  useEffect(() => {
    if (!notice.message) return undefined;
    const timeoutId = window.setTimeout(() => {
      setNotice({ tone: "success", message: "" });
    }, 15000);
    return () => window.clearTimeout(timeoutId);
  }, [notice.message]);

  const planEnd = useMemo(() => {
    if (!user?.planEnd) return null;
    const date = new Date(user.planEnd);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [user]);

  const isExpired = useMemo(() => {
    if (!planEnd) return false;
    return planEnd.getTime() < Date.now();
  }, [planEnd]);

  function updateTemplate(templateKey, field, value) {
    setTemplates((prev) => ({
      ...prev,
      [templateKey]: {
        ...(prev?.[templateKey] || {}),
        [field]: value,
      },
    }));
  }

  async function saveTemplates() {
    setSaving(true);
    setNotice({ tone: "success", message: "" });

    try {
      const res = await fetch("/api/config/save-email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });

      if (!res.ok) {
        throw new Error("Failed to save email templates");
      }

      setNotice({ tone: "success", message: "Email templates saved successfully." });
    } catch (error) {
      console.error("save email templates error:", error);
      setNotice({ tone: "critical", message: "Failed to save email templates." });
    } finally {
      setSaving(false);
    }
  }

  if (user === undefined || loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  if (!user) {
    return <p style={{ padding: 20 }}>Redirecting...</p>;
  }

  if (isExpired) {
    return (
      <Page title="Email Template">
        <LegacyCard sectioned>
          <Banner tone="critical">
            <p>Your license has expired. Please renew to access email template settings.</p>
          </Banner>
        </LegacyCard>
      </Page>
    );
  }

  return (
    <div style={ui.shell}>
      <Page title="Email Template">
        <div style={ui.hero}>
          <h1 style={ui.heroTitle}>Email Template</h1>
          <p style={ui.heroSub}>
            Manage the subject and body content for referral, gift card, points earned, and points redeemed emails.
            Placeholder values like {"{{giftCode}}"}, {"{{referralCode}}"}, and {"{{availablePoints}}"} will be filled
            automatically when the email is sent.
          </p>
        </div>

        <LegacyCard sectioned>
          {notice.message ? (
            <div style={{ marginBottom: 12 }}>
              <Banner tone={notice.tone} onDismiss={() => setNotice({ tone: "success", message: "" })}>
                <p>{notice.message}</p>
              </Banner>
            </div>
          ) : null}

          <Tabs
            tabs={TEMPLATE_ORDER.map((templateKey) => ({
              id: templateKey,
              content: TEMPLATE_LABELS[templateKey].title,
              panelID: `${templateKey}-panel`,
            }))}
            selected={activeTab}
            onSelect={setActiveTab}
          />

          {(() => {
            const templateKey = TEMPLATE_ORDER[activeTab] || TEMPLATE_ORDER[0];
            const template = templates?.[templateKey] || {};
            const meta = TEMPLATE_LABELS[templateKey];
            const placeholders = Array.isArray(template.placeholders) ? template.placeholders : [];

            return (
              <div style={{ ...ui.templateStack, marginTop: 16 }}>
                <div style={{ border: "1px solid #dbe8f8", borderRadius: 18, padding: 16 }}>
                  <h2 style={ui.cardTitle}>{meta.title}</h2>
                  <p style={ui.cardSub}>{meta.description}</p>

                  <div style={ui.helperWrap}>
                    {placeholders.map((item) => (
                      <span key={`${templateKey}-${item}`} style={ui.helperPill}>
                        {`{{${item}}}`}
                      </span>
                    ))}
                  </div>

                  <FormLayout>
                    <TextField
                      label="Subject"
                      autoComplete="off"
                      value={template.subject || ""}
                      onChange={(value) => updateTemplate(templateKey, "subject", value)}
                    />
                    <TextField
                      label="Body"
                      autoComplete="off"
                      multiline={10}
                      value={template.textBody || ""}
                      onChange={(value) => updateTemplate(templateKey, "textBody", value)}
                      helpText="Plain text body is enough. Line breaks will be preserved in the email."
                    />
                  </FormLayout>
                </div>
              </div>
            );
          })()}

          <div style={ui.saveRow}>
            <Button variant="primary" onClick={saveTemplates} loading={saving}>
              Save
            </Button>
          </div>
        </LegacyCard>

        <style jsx global>{`
          .Polaris-Page {
            max-width: 1080px;
          }

          .Polaris-LegacyCard {
            border-radius: 20px;
            border: 1px solid #dce7f4;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
            background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          }

          .Polaris-Tabs__TabList {
            margin-bottom: 4px;
          }

          .Polaris-Tabs__Tab {
            border-radius: 10px;
          }

          .Polaris-TextField {
            border-radius: 12px;
            border-color: #d8e3f3;
            background: #ffffff;
          }

          .Polaris-TextField:focus-within {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
          }

          .Polaris-Button--variantPrimary {
            background: linear-gradient(120deg, #2563eb, #0f766e);
            border-color: transparent;
            border-radius: 10px;
            box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
          }

          @media (max-width: 768px) {
            .Polaris-Page {
              max-width: 100%;
            }
          }
        `}</style>
      </Page>
    </div>
  );
}
