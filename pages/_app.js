import App from "next/app";
import { AppProvider } from "@shopify/polaris";
import createApp from "@shopify/app-bridge";
import { NavigationMenu } from "@shopify/app-bridge/actions";
import * as AppLink from "@shopify/app-bridge/actions/Link/AppLink";
import "@shopify/polaris/build/esm/styles.css";
import { useEffect, useState } from "react";

function isLikelyHostParam(value) {
  if (!value) return false;
  // Shopify passes base64-encoded host; allow standard and URL-safe base64 characters.
  return /^[A-Za-z0-9+/=_-]+$/.test(String(value));
}

function MyApp({ Component, pageProps }) {
  const [config, setConfig] = useState(null);
  const [hostMissing, setHostMissing] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [shopMissing, setShopMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop") || window.localStorage.getItem("shopify-shop-domain") || "";
    const hostFromQuery = params.get("host");
    const scopedHostKey = shop ? `shopify-app-host:${shop}` : "";
    let host = "";

    if (shop) {
      setShopDomain(shop);
      window.localStorage.setItem("shopify-shop-domain", shop);
    } else {
      setShopMissing(true);
    }

    if (isLikelyHostParam(hostFromQuery)) {
      host = hostFromQuery;
      window.localStorage.setItem("shopify-app-host", hostFromQuery);
      if (scopedHostKey) {
        window.localStorage.setItem(scopedHostKey, hostFromQuery);
      }
    } else if (scopedHostKey) {
      const storedScopedHost = window.localStorage.getItem(scopedHostKey) || "";
      if (isLikelyHostParam(storedScopedHost)) {
        host = storedScopedHost;
      }
    }

    if (!isLikelyHostParam(host)) {
      console.error("Missing host param");
      setHostMissing(true);
      return;
    }

    setConfig({
      apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY,
      host,
      // Avoid forced bounce loops when host is stale or store context changed.
      forceRedirect: false,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
  }, []);

  useEffect(() => {
    if (!shopDomain) return;

    fetch(`/api/auth/ensure-storefront-loader?shop=${encodeURIComponent(shopDomain)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        console.log("ensure-storefront-loader response:", data);
      })
      .catch((error) => {
        console.error("Failed to ensure storefront loader:", error);
      });
  }, [shopDomain]);

  useEffect(() => {
    if (!config?.host) return;

    try {
      const app = createApp(config);
      const items = [
        AppLink.create(app, { label: "Products", destination: "/loyalty-config" }),
        AppLink.create(app, { label: "Events", destination: "/loyalty-events" }),
        AppLink.create(app, { label: "Customers ", destination: "/loyalty-customers" }),
        // AppLink.create(app, { label: "Items", destination: "/loyalty-items" }),
        AppLink.create(app, { label: "Giftcard Generated", destination: "/loyalty-giftcard-generated" }),
        AppLink.create(app, { label: "Features", destination: "/loyalty-features" }),
      ];
      NavigationMenu.create(app, { items });
    } catch (err) {
      console.error("Navigation menu init error:", err);
    }
  }, [config]);

  if (!config && !hostMissing) {
    return <p style={{ padding: 20 }}>Loading App...</p>;
  }

  if (hostMissing) {
    return (
      <AppProvider>
        <div style={{ padding: 20 }}>
          <p>Missing Shopify host context. Reopen this app from Shopify Admin Apps.</p>
          {shopDomain && (
            <p>
              <a href={`/auth?shop=${encodeURIComponent(shopDomain)}`}>Reauthorize this store</a>
            </p>
          )}
          {shopMissing && <p>Store domain is missing from URL and storage.</p>}
        </div>
      </AppProvider>
    );
  }

  return (
    <AppProvider>
      <Component {...pageProps} />
    </AppProvider>
  );
}

export default MyApp;

MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);
  return { ...appProps };
};
