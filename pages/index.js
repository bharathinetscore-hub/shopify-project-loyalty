import { useEffect } from "react";

export default function Index() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const shop = params.get("shop");
    const host = params.get("host");

    // 🚨 IMPORTANT: Shopify embedded fix
    if (shop && host) {
      window.location.href = `/dashboard?shop=${shop}&host=${host}`;
    } else {
      console.error("Missing shop or host");
    }
  }, []);

  return <p>Loading Shopify App...</p>;
}