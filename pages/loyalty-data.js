import { useEffect, useMemo, useState } from "react";
import createApp from "@shopify/app-bridge";
import { Redirect, ResourcePicker } from "@shopify/app-bridge/actions";
import {
  Page,
  LegacyCard,
  Button,
  ButtonGroup,
  Banner,
  Badge,
  Tabs,
  Modal,
  FormLayout,
  Select,
  TextField,
  Text,
} from "@shopify/polaris";

/* ---------------- UI Styles ---------------- */

const ui = {
  wrap: { paddingTop: 12 },
  sectionStack: {
    display: "grid",
    gap: 18,
  },

  title: {
    margin: "0 0 12px",
    fontSize: 24,
    fontWeight: 700,
    color: "#0f172a",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#0b1220",
  },
  sectionSubtitle: {
    margin: "6px 0 0",
    color: "#5b6475",
    fontSize: 13,
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  statPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid #d6e4f0",
    background: "#f8fbff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 600,
  },

  tools: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  group: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  input: {
    minWidth: 220,
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
  },

  select: {
    minWidth: 200,
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
  },
  fieldWrap: {
    minWidth: 280,
  },
  fieldSelectWrap: {
    minWidth: 220,
  },

  tableWrap: {
    overflowX: "auto",
    border: "1px solid #d9e4f7",
    borderRadius: 12,
    background: "#ffffff",
  },

  th: {
    textAlign: "left",
    padding: "13px 12px",
    background: "linear-gradient(180deg, #f5f9ff 0%, #edf4ff 100%)",
    borderBottom: "1px solid #d9e4f7",
    fontSize: 12,
    letterSpacing: "0.2px",
    textTransform: "uppercase",
    color: "#334155",
    fontWeight: 700,
  },

  td: {
    padding: "12px",
    borderBottom: "1px solid #edf2fb",
    color: "#1f2937",
    fontSize: 14,
  },
  rowEven: {
    background: "#ffffff",
  },
  rowOdd: {
    background: "#fbfdff",
  },

  empty: {
    padding: 18,
    color: "#64748b",
    fontSize: 14,
  },
  paginationWrap: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  paginationMeta: {
    fontSize: 13,
    color: "#64748b",
  },
  paginationBtns: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
};

/* ---------------- Table Component ---------------- */

function Table({ columns, rows, emptyLabel = "No records to display" }) {
  return (
    <div style={ui.tableWrap}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={ui.th}>
                {col}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                style={ui.empty}
                colSpan={columns.length}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} style={i % 2 === 0 ? ui.rowEven : ui.rowOdd}>
                {row.map((cell, j) => (
                  <td key={j} style={ui.td}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaginatedTable({
  columns,
  rows,
  page,
  setPage,
  perPage = 3,
  setPerPage = null,
  emptyLabel = "No records to display",
}) {
  const totalPages = Math.max(1, Math.ceil((rows?.length || 0) / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const pageRows = (rows || []).slice(start, start + perPage);
  const perPageOptions = Array.from({ length: 20 }, (_, index) => {
    const value = String(index + 1);
    return { label: value, value };
  });

  return (
    <>
      <Table columns={columns} rows={pageRows} emptyLabel={emptyLabel} />
      <div style={ui.paginationWrap}>
        <div style={{ ...ui.paginationBtns, flexWrap: "wrap" }}>
          {setPerPage ? (
            <div style={{ minWidth: 150 }}>
              <Select
                label="Rows per page"
                labelHidden
                options={perPageOptions}
                value={String(perPage)}
                onChange={(value) => {
                  setPerPage(Number(value));
                  setPage(1);
                }}
              />
            </div>
          ) : null}
          <div style={ui.paginationMeta}>
            Page {safePage} of {totalPages} ({rows.length} item{rows.length === 1 ? "" : "s"})
          </div>
        </div>
        <div style={ui.paginationBtns}>
          <Button
            size="slim"
            disabled={safePage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <Button
            size="slim"
            disabled={safePage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}

/* ---------------- Main Page ---------------- */

export function LoyaltyDashboard({ forcedTab = null } = {}) {
  const [user, setUser] = useState(undefined);
  const [activeTab, setActiveTab] = useState(0);
  const [productOptions, setProductOptions] = useState([]);
  const [productOptionsError, setProductOptionsError] = useState("");
  const [productOptionsInfo, setProductOptionsInfo] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [enabledItems, setEnabledItems] = useState([]);
  const [enabledItemsLoading, setEnabledItemsLoading] = useState(false);
  const [enabledItemsError, setEnabledItemsError] = useState("");
  const [enabledItemsSearch, setEnabledItemsSearch] = useState("");
  const [enabledItemsFilter, setEnabledItemsFilter] = useState("all");
  const [showEnabledItemsTable, setShowEnabledItemsTable] = useState(false);
  const [itemsTabRows, setItemsTabRows] = useState([]);
  const [itemsTabLoading, setItemsTabLoading] = useState(false);
  const [itemsTabError, setItemsTabError] = useState("");
  const [itemsTabSearch, setItemsTabSearch] = useState("");
  const [itemsTabType, setItemsTabType] = useState("all");
  const [eventsRows, setEventsRows] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventsSearch, setEventsSearch] = useState("");
  const [giftcardsRows, setGiftcardsRows] = useState([]);
  const [giftcardsLoading, setGiftcardsLoading] = useState(false);
  const [giftcardsError, setGiftcardsError] = useState("");
  const [giftcardsEmailSearch, setGiftcardsEmailSearch] = useState("");
  const [giftcardsCodeSearch, setGiftcardsCodeSearch] = useState("");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEventSaving, setIsEventSaving] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null,
    nsId: "",
    eventId: "",
    eventName: "",
    isActive: true,
  });
  const [customersRows, setCustomersRows] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customersInfo, setCustomersInfo] = useState("");
  const [customersSearch, setCustomersSearch] = useState("");
  const [customerSectionTab, setCustomerSectionTab] = useState("customers");
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [customerCandidates, setCustomerCandidates] = useState([]);
  const [customerCandidatesLoading, setCustomerCandidatesLoading] = useState(false);
  const [customerCandidatesSearch, setCustomerCandidatesSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
  const [isCustomerProfileSaving, setIsCustomerProfileSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isCustomerViewModalOpen, setIsCustomerViewModalOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [viewingCustomerEvents, setViewingCustomerEvents] = useState([]);
  const [viewingCustomerEventsLoading, setViewingCustomerEventsLoading] = useState(false);
  const [viewingCustomerEventsError, setViewingCustomerEventsError] = useState("");
  const [isCustomerEventModalOpen, setIsCustomerEventModalOpen] = useState(false);
  const [isCustomerEventSaving, setIsCustomerEventSaving] = useState(false);
  const [customerEventTarget, setCustomerEventTarget] = useState(null);
  const [customerEventForm, setCustomerEventForm] = useState({
    eventId: "",
    eventName: "",
    pointsType: "positive",
    pointsValue: "",
    amount: "",
    comments: "",
    dateCreated: "",
  });

  const [customersPage, setCustomersPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [giftcardsPage, setGiftcardsPage] = useState(1);
  const [enabledItemsPage, setEnabledItemsPage] = useState(1);
  const [loyaltyProductsPage, setLoyaltyProductsPage] = useState(1);
  const [customersPerPage, setCustomersPerPage] = useState(10);
  const [eventsPerPage, setEventsPerPage] = useState(10);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [giftcardsPerPage, setGiftcardsPerPage] = useState(10);
  const [enabledItemsPerPage, setEnabledItemsPerPage] = useState(10);
  const [loyaltyProductsPerPage, setLoyaltyProductsPerPage] = useState(10);

  function getEmbeddedQueryString(extraParams = {}) {
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
    const merged = new URLSearchParams();

    if (host) merged.set("host", host);
    if (shop) merged.set("shop", shop);
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        merged.set(key, String(value));
      }
    });

    const query = merged.toString();
    return query ? `?${query}` : "";
  }

  function getShopFromUrlOrStorage() {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("shop") || window.localStorage.getItem("shopify-shop-domain") || "";
  }

  function reauthorizeShopifyIfNeeded() {
    const shop = getShopFromUrlOrStorage();
    if (!shop || typeof window === "undefined") return false;

    // OAuth must not run inside the Admin iframe (accounts.shopify.com blocks framing).
    // Use App Bridge REMOTE redirect so the parent/top context navigates, or open a new tab.
    const embeddedQs = getEmbeddedQueryString();
    const path = embeddedQs ? `/auth${embeddedQs}` : `/auth?shop=${encodeURIComponent(shop)}`;
    const fullUrl = `${window.location.origin}${path}`;

    const bridgeConfig = getEmbeddedAppBridgeConfig();
    if (bridgeConfig?.apiKey && bridgeConfig?.host) {
      try {
        const app = createApp(bridgeConfig);
        const redirect = Redirect.create(app);
        redirect.dispatch(Redirect.Action.REMOTE, { url: fullUrl });
        return true;
      } catch (err) {
        console.error("App Bridge reauthorize redirect failed:", err);
      }
    }

    window.open(fullUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  function getEmbeddedAppBridgeConfig() {
    if (typeof window === "undefined") return null;

    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop") || window.localStorage.getItem("shopify-shop-domain") || "";
    const scopedHostKey = shop ? `shopify-app-host:${shop}` : "";
    const hostFromQuery = params.get("host") || "";
    const host = hostFromQuery || (scopedHostKey ? window.localStorage.getItem(scopedHostKey) || "" : "");

    if (hostFromQuery && scopedHostKey) {
      window.localStorage.setItem(scopedHostKey, hostFromQuery);
    }

    if (!host) return null;

    return {
      apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY,
      host,
      forceRedirect: true,
    };
  }

  function normalizePickedCustomer(item = {}) {
    const rawId = String(item?.id || "").trim();
    const id = rawId.includes("/") ? rawId.split("/").pop() : rawId;
    const firstName = String(item?.firstName || "").trim();
    const lastName = String(item?.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const fallbackName = String(item?.displayName || item?.title || "").trim();
    const email = String(item?.email || item?.defaultEmailAddress?.emailAddress || "").trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const safeFallbackName =
      fallbackName && !emailPattern.test(fallbackName) && fallbackName.toLowerCase() !== email.toLowerCase()
        ? fallbackName
        : "";

    return {
      id,
      name: fullName || safeFallbackName || "",
      email,
    };
  }

  function normalizeDateForInput(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

  function extractSkuFromPickerItem(item) {
    const direct = String(item?.sku || "").trim();
    if (direct) return direct;

    const variantsArray = Array.isArray(item?.variants) ? item.variants : [];
    const variantSku = variantsArray.find((variant) => String(variant?.sku || "").trim())?.sku;
    if (variantSku) return String(variantSku);

    const variantNodes = Array.isArray(item?.variants?.nodes) ? item.variants.nodes : [];
    const nodeSku = variantNodes.find((variant) => String(variant?.sku || "").trim())?.sku;
    if (nodeSku) return String(nodeSku);

    const variantEdges = Array.isArray(item?.variants?.edges) ? item.variants.edges : [];
    const edgeSku = variantEdges.find((edge) => String(edge?.node?.sku || "").trim())?.node?.sku;
    if (edgeSku) return String(edgeSku);

    return "";
  }

  async function hydratePickedProductsWithSavedSettings(pickedProducts) {
    try {
      const productIds = pickedProducts.map((item) => item.id).filter(Boolean);
      if (!productIds.length) return pickedProducts;

      const res = await fetch("/api/loyalty/get-product-configs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data?.items)) {
        return pickedProducts;
      }

      const byId = new Map(data.items.map((row) => [String(row.productId), row]));
      return pickedProducts.map((item) => {
        const saved = byId.get(String(item.id));
        if (!saved) return item;
        return {
          ...item,
          enableLoyalty: !!saved.enableLoyalty,
          enableCollection: !!saved.enableCollection,
          collectionType: saved.collectionType === "sku" ? "sku" : "points",
          pointsValue: String(saved.pointsValue ?? ""),
          skuValue: String(saved.skuValue ?? ""),
        };
      });
    } catch (error) {
      console.error("hydratePickedProductsWithSavedSettings error:", error);
      return pickedProducts;
    }
  }

  /* ---------------- Load User ---------------- */

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
    if (!productOptionsInfo) return undefined;

    const timeoutId = window.setTimeout(() => {
      setProductOptionsInfo("");
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [productOptionsInfo]);

  useEffect(() => {
    if (!customersInfo) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCustomersInfo("");
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [customersInfo]);

  /* ---------------- License Check ---------------- */

  const planEnd = useMemo(() => {
    if (!user?.planEnd) return null;

    const d = new Date(user.planEnd);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [user]);

  const isExpired = useMemo(() => {
    if (!planEnd) return false;
    return planEnd.getTime() < Date.now();
  }, [planEnd]);

  /* ---------------- Tabs ---------------- */

  const tabs = [
    { id: "customers", content: "Customers" },
    { id: "events", content: "Events" },
    { id: "items", content: "Items" },
    { id: "giftcards", content: "Giftcards" },
    { id: "loyalty-config", content: "Loyalty Products" },
  ];

  const tabRoutes = [
    "/loyalty-customers",
    "/loyalty-events",
    "/loyalty-items",
    "/loyalty-giftcard-generated",
    "/loyalty-config",
  ];

  useEffect(() => {
    function syncTabFromPath() {
      if (typeof window === "undefined") return;
      const searchTab = new URLSearchParams(window.location.search).get("tab");

      if (searchTab === "events") {
        setActiveTab(1);
        return;
      }
      if (searchTab === "items") {
        setActiveTab(2);
        return;
      }
      if (searchTab === "giftcard-generated") {
        setActiveTab(3);
        return;
      }
      if (searchTab === "loyalty-config") {
        setActiveTab(4);
        return;
      }
      if (searchTab === "customers") {
        setActiveTab(0);
        return;
      }

      if (forcedTab) {
        if (forcedTab === "events") setActiveTab(1);
        else if (forcedTab === "items") setActiveTab(2);
        else if (forcedTab === "giftcard-generated") setActiveTab(3);
        else if (forcedTab === "loyalty-config") setActiveTab(4);
        else setActiveTab(0);
        return;
      }

      const path = window.location.pathname;
      if (path.includes("/loyalty-events")) {
        setActiveTab(1);
      } else if (path.includes("/loyalty-items")) {
        setActiveTab(2);
      } else if (path.includes("/loyalty-giftcard-generated")) {
        setActiveTab(3);
      } else if (path.includes("/loyalty-config")) {
        setActiveTab(4);
      } else {
        setActiveTab(0);
      }
    }

    syncTabFromPath();
    const pollId = setInterval(syncTabFromPath, 200);

    return () => {
      clearInterval(pollId);
    };
  }, [forcedTab]);

  function handleTabSelect(index) {
    setActiveTab(index);
    const route = tabRoutes[index] || "/loyalty-customers";
    const nextPath = `${route}${getEmbeddedQueryString()}`;
    if (
      typeof window !== "undefined" &&
      `${window.location.pathname}${window.location.search}` !== nextPath
    ) {
      window.location.assign(nextPath);
    }
  }

  function openProductPicker() {
    if (typeof window === "undefined") return;
    const appConfig = getEmbeddedAppBridgeConfig();
    if (!appConfig) {
      setProductOptionsError("Missing host parameter for Shopify App Bridge.");
      setProductOptionsInfo("");
      return;
    }

    setProductOptionsError("");
    setProductOptionsInfo("");

    const app = createApp(appConfig);

    const picker = ResourcePicker.create(app, {
      resourceType: ResourcePicker.ResourceType.Product,
      options: {
        selectMultiple: true,
        showHidden: false,
      },
    });

    const unselect = picker.subscribe(ResourcePicker.Action.SELECT, async ({ selection }) => {
      const picked = (selection || []).map((item) => {
        const gid = String(item?.id || "");
        const id = gid.split("/").pop() || "";
        const name = String(item?.title || "");
        const sku = extractSkuFromPickerItem(item);
        return {
          id,
          name,
          sku: String(sku || ""),
          enableLoyalty: false,
          enableCollection: false,
          collectionType: "points",
          pointsValue: "",
          skuValue: "",
          label: `${name || "Untitled Product"} (${id})`,
        };
      });
      const hydrated = await hydratePickedProductsWithSavedSettings(picked);
      setProductOptions(hydrated);
      setLoyaltyProductsPage(1);
      setProductOptionsInfo(hydrated.length ? "Loaded from Shopify Product Picker." : "No products selected.");
      unselect();
      uncancel();
    });

    const uncancel = picker.subscribe(ResourcePicker.Action.CANCEL, () => {
      uncancel();
      unselect();
    });

    picker.dispatch(ResourcePicker.Action.OPEN);
  }

  async function openCustomerPicker() {
    if (typeof window === "undefined") return;

    try {
      setCustomersError("");
      setCustomersInfo("");

      let picked = [];

      // Primary approach: runtime picker exposed by Shopify Admin.
      const runtimePicker = window?.shopify?.resourcePicker;
      if (typeof runtimePicker === "function") {
        try {
          const runtimeSelection = await runtimePicker({
            type: "customer",
            action: "select",
            multiple: true,
          });
          picked = Array.isArray(runtimeSelection) ? runtimeSelection : [];
        } catch (pickerErr) {
          console.error("runtime customer picker unavailable:", pickerErr);
        }
      }

      // Secondary fallback: App Bridge ResourcePicker with timeout safety.
      if (!picked.length) {
        const appConfig = getEmbeddedAppBridgeConfig();
        if (appConfig) {
          try {
            const app = createApp(appConfig);
            const customerResourceType = ResourcePicker?.ResourceType?.Customer || "Customer";
            const picker = ResourcePicker.create(app, {
              resourceType: customerResourceType,
              options: {
                selectMultiple: true,
                showHidden: false,
              },
            });

            picked = await new Promise((resolve) => {
              const timeout = setTimeout(() => {
                resolve([]);
              }, 3000);

              const unselect = picker.subscribe(ResourcePicker.Action.SELECT, ({ selection }) => {
                clearTimeout(timeout);
                resolve(Array.isArray(selection) ? selection : []);
                unselect();
                uncancel();
              });

              const uncancel = picker.subscribe(ResourcePicker.Action.CANCEL, () => {
                clearTimeout(timeout);
                resolve([]);
                uncancel();
                unselect();
              });

              picker.dispatch(ResourcePicker.Action.OPEN);
            });
          } catch (pickerErr) {
            console.error("App Bridge customer picker unavailable:", pickerErr);
          }
        }
      }

      if (!picked.length) {
        // Show store customers directly so merchant can pick and add.
        setIsCustomerPickerOpen(true);
        setSelectedCustomerIds([]);
        await loadCustomerCandidates({ q: "" });
        return;
      }

      const customers = picked.map(normalizePickedCustomer).filter((item) => item.id);

      if (!customers.length) {
        throw new Error("No valid customers returned from Shopify picker.");
      }

      const saveRes = await fetch("/api/loyalty/save-customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ customers }),
      });

      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveData?.error || "Failed to save selected customers");
      }

      setCustomersInfo(`Saved ${Number(saveData?.saved || customers.length)} customer(s).`);
      await loadSavedCustomers({ q: customersSearch });
      setCustomersPage(1);
    } catch (error) {
      console.error("openCustomerPicker error:", error);
      setCustomersError(error?.message || "Failed to open customer picker");
    }
  }

  async function loadCustomerCandidates({ q = customerCandidatesSearch } = {}) {
    setCustomerCandidatesLoading(true);
    setCustomersError("");
    try {
      const shop = getShopFromUrlOrStorage();
      if (!shop) {
        setCustomerCandidates([]);
        setCustomersError("Missing shop in URL.");
        return;
      }

      const params = new URLSearchParams({
        shop: String(shop),
        q: String(q || ""),
      });
      const res = await fetch(`/api/loyalty/get-customers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !Array.isArray(data?.customers)) {
        const errorMessage = String(data?.error || "Failed to load customers");
        if (res.status === 401) {
          setCustomersError(
            "Shopify session expired or missing. Starting re-authorization (check for a new tab if the app did not redirect)."
          );
          const redirected = reauthorizeShopifyIfNeeded();
          if (!redirected) {
            setCustomersError("Shopify session expired. Please reopen app from Shopify Admin.");
          }
          setCustomerCandidates([]);
          return;
        }
        setCustomerCandidates([]);
        setCustomersError(errorMessage);
        return;
      }

      setCustomerCandidates(data.customers);
    } catch (error) {
      console.error("loadCustomerCandidates error:", error);
      setCustomerCandidates([]);
      setCustomersError(error?.message || "Failed to load customers");
    } finally {
      setCustomerCandidatesLoading(false);
    }
  }

  function toggleCandidateCustomer(id) {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveSelectedCandidateCustomers() {
    try {
      const selected = customerCandidates.filter((row) => selectedCustomerIds.includes(String(row.id)));
      if (!selected.length) {
        setCustomersError("Select at least one customer.");
        return;
      }

      const saveRes = await fetch("/api/loyalty/save-customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ customers: selected }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveData?.error || "Failed to save selected customers");
      }

      setCustomersInfo(`Saved ${Number(saveData?.saved || selected.length)} customer(s).`);
      setIsCustomerPickerOpen(false);
      setSelectedCustomerIds([]);
      await loadSavedCustomers({ q: customersSearch });
      setCustomersPage(1);
    } catch (error) {
      console.error("saveSelectedCandidateCustomers error:", error);
      setCustomersError(error?.message || "Failed to save selected customers");
    }
  }

  function openCustomerEditModal(row) {
    setEditingCustomer({
      id: String(row?.id || ""),
      name: String(row?.name || ""),
      email: String(row?.email || ""),
      eligibleForLoyalty: Boolean(row?.eligibleForLoyalty),
      birthday: normalizeDateForInput(row?.birthday),
      anniversary: normalizeDateForInput(row?.anniversary),
      referralCode: String(row?.referralCode || ""),
      usedReferralCode: String(row?.usedReferralCode || ""),
      totalEarnedPoints: String(row?.totalEarnedPoints ?? 0),
      totalRedeemedPoints: String(row?.totalRedeemedPoints ?? 0),
      availablePoints: String(row?.availablePoints ?? 0),
    });
    setIsCustomerEditModalOpen(true);
  }

  function openCustomerViewModal(row) {
    setViewingCustomer({
      id: String(row?.id || ""),
      name: String(row?.name || ""),
      email: String(row?.email || ""),
      eligibleForLoyalty: Boolean(row?.eligibleForLoyalty),
      birthday: normalizeDateForInput(row?.birthday),
      anniversary: normalizeDateForInput(row?.anniversary),
      referralCode: String(row?.referralCode || ""),
      usedReferralCode: String(row?.usedReferralCode || ""),
      totalEarnedPoints: Number(row?.totalEarnedPoints || 0),
      totalRedeemedPoints: Number(row?.totalRedeemedPoints || 0),
      availablePoints: Number(row?.availablePoints || 0),
    });
    setViewingCustomerEvents([]);
    setViewingCustomerEventsError("");
    setIsCustomerViewModalOpen(true);
    loadCustomerEvents(row);
  }

  function resetCustomerEventForm() {
    setCustomerEventForm({
      eventId: "",
      eventName: "",
      pointsType: "positive",
      pointsValue: "",
      amount: "",
      comments: "",
      dateCreated: "",
    });
  }

  function openCustomerEventModal(row) {
    setCustomerEventTarget({
      id: String(row?.id || ""),
      name: String(row?.name || ""),
      email: String(row?.email || ""),
    });
    resetCustomerEventForm();
    setIsCustomerEventModalOpen(true);
  }

  async function saveCustomerEvent() {
    if (!customerEventTarget?.id) {
      setCustomersError("Customer ID is required.");
      return;
    }

    if (!customerEventForm.eventId && !customerEventForm.eventName.trim()) {
      setCustomersError("Select an event or enter an event name.");
      return;
    }

    if (!customerEventForm.pointsValue || Number(customerEventForm.pointsValue) <= 0) {
      setCustomersError("Points value must be greater than 0.");
      return;
    }

    try {
      setIsCustomerEventSaving(true);
      setCustomersError("");

      const selectedEvent = eventsRows.find(
        (event) => String(event.eventId || "") === String(customerEventForm.eventId || "")
      );

      const res = await fetch("/api/loyalty/save-customer-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          customerId: customerEventTarget.id,
          customerEmail: customerEventTarget.email,
          eventId: customerEventForm.eventId || "",
          eventName: customerEventForm.eventName || selectedEvent?.eventName || "",
          pointsType: customerEventForm.pointsType,
          pointsValue: customerEventForm.pointsValue,
          amount: customerEventForm.amount || 0,
          comments: customerEventForm.comments || "",
          dateCreated: customerEventForm.dateCreated || "",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save customer event");
      }

      const savedCustomer = data.customer || {};
      setCustomersRows((prev) =>
        prev.map((row) =>
          String(row.id) === String(savedCustomer.id)
            ? {
                ...row,
                totalEarnedPoints: Number(savedCustomer.totalEarnedPoints || 0),
                totalRedeemedPoints: Number(savedCustomer.totalRedeemedPoints || 0),
                availablePoints: Number(savedCustomer.availablePoints || 0),
              }
            : row
        )
      );

      if (viewingCustomer && String(viewingCustomer.id) === String(savedCustomer.id)) {
        setViewingCustomer((prev) =>
          prev
            ? {
                ...prev,
                totalEarnedPoints: Number(savedCustomer.totalEarnedPoints || 0),
                totalRedeemedPoints: Number(savedCustomer.totalRedeemedPoints || 0),
                availablePoints: Number(savedCustomer.availablePoints || 0),
              }
            : prev
        );
        await loadCustomerEvents(savedCustomer);
      }

      setCustomersInfo(
        `Added ${data?.event?.eventName || "customer event"} for ${customerEventTarget.name || customerEventTarget.id}.`
      );
      setIsCustomerEventModalOpen(false);
      setCustomerEventTarget(null);
      resetCustomerEventForm();
    } catch (error) {
      console.error("saveCustomerEvent error:", error);
      setCustomersError(error?.message || "Failed to save customer event");
    } finally {
      setIsCustomerEventSaving(false);
    }
  }

  async function loadCustomerEvents(row) {
    const customerId = String(row?.id || "").trim();
    const email = String(row?.email || "").trim();

    if (!customerId && !email) {
      setViewingCustomerEvents([]);
      setViewingCustomerEventsError("Customer ID or email is required to load events.");
      return;
    }

    try {
      setViewingCustomerEventsLoading(true);
      setViewingCustomerEventsError("");

      const params = new URLSearchParams();
      if (customerId) params.set("customerId", customerId);
      if (email) params.set("email", email);

      const res = await fetch(`/api/loyalty/get-customer-events?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !Array.isArray(data?.events)) {
        throw new Error(data?.error || "Failed to load customer events");
      }

      setViewingCustomerEvents(data.events);
    } catch (error) {
      console.error("loadCustomerEvents error:", error);
      setViewingCustomerEvents([]);
      setViewingCustomerEventsError(error?.message || "Failed to load customer events");
    } finally {
      setViewingCustomerEventsLoading(false);
    }
  }

  function downloadSingleCustomerCsv(row, events = []) {
    if (!row) return;
    const headers = [
      "Customer ID",
      "Customer Name",
      "Customer Email",
      "Event Date",
      "Event Name",
      "Amount",
      "Points Earned",
      "Points Redeemed",
      "Points Left",
      "Created At",
    ];
    const lines = (events || []).map((event) =>
      [
        row.id || "",
        row.name || "",
        row.email || "",
        event.date || "",
        event.eventName || "",
        Number(event.amount || 0).toFixed(2),
        Number(event.pointsEarned || 0).toFixed(2),
        Number(event.pointsRedeemed || 0).toFixed(2),
        Number(event.pointsLeft || 0).toFixed(2),
        event.createdAt || "",
      ]
        .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-events-${row.id || "history"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAllCustomersCsv() {
    const headers = [
      "S.No",
      "Customer ID",
      "Name",
      "Email",
      "Total Earned Points",
      "Total Redeemed Points",
      "Available Points",
      "Eligible",
      "Birthday",
      "Anniversary",
      "Referral Code",
      "Used Referral Code",
    ];
    const lines = customersRows.map((row, index) =>
      [
        index + 1,
        row.id || "",
        row.name || "",
        row.email || "",
        Number(row.totalEarnedPoints || 0),
        Number(row.totalRedeemedPoints || 0),
        Number(row.availablePoints || 0),
        row.eligibleForLoyalty ? "Yes" : "No",
        row.birthday ? String(row.birthday).slice(0, 10) : "",
        row.anniversary ? String(row.anniversary).slice(0, 10) : "",
        row.referralCode || "",
        row.usedReferralCode || "",
      ]
        .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loyalty-customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveCustomerProfile(profilePatch = null) {
    const profile = profilePatch || editingCustomer;
    if (!profile?.id) {
      setCustomersError("Customer ID is required.");
      return;
    }

    try {
      setIsCustomerProfileSaving(true);
      setCustomersError("");

      const res = await fetch("/api/loyalty/save-customer-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          source: "admin",
          customerId: profile.id,
          eligibleForLoyalty: !!profile.eligibleForLoyalty,
          birthday: profile.birthday || null,
          anniversary: profile.anniversary || null,
          referralCode: profile.referralCode || "",
          usedReferralCode: profile.usedReferralCode || "",
          totalEarnedPoints: profile.totalEarnedPoints,
          totalRedeemedPoints: profile.totalRedeemedPoints,
          availablePoints: profile.availablePoints,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save customer profile");
      }

      const saved = data.customer || profile;
      setCustomersRows((prev) =>
        prev.map((row) =>
          String(row.id) === String(saved.id)
            ? {
                ...row,
                eligibleForLoyalty: !!saved.eligibleForLoyalty,
                birthday: saved.birthday || null,
                anniversary: saved.anniversary || null,
                referralCode: saved.referralCode || "",
                usedReferralCode: saved.usedReferralCode || "",
                totalEarnedPoints: Number(saved.totalEarnedPoints || 0),
                totalRedeemedPoints: Number(saved.totalRedeemedPoints || 0),
                availablePoints: Number(saved.availablePoints || 0),
              }
            : row
        )
      );

      setCustomersInfo(`Updated customer ${saved.id}.`);
      if (!profilePatch) {
        setIsCustomerEditModalOpen(false);
      }
    } catch (error) {
      console.error("saveCustomerProfile error:", error);
      setCustomersError(error?.message || "Failed to save customer profile");
    } finally {
      setIsCustomerProfileSaving(false);
    }
  }

  function toggleCustomerEligible(row) {
    const nextEligible = !Boolean(row?.eligibleForLoyalty);
    const nextProfile = {
      id: String(row?.id || ""),
      eligibleForLoyalty: nextEligible,
      birthday: normalizeDateForInput(row?.birthday),
      anniversary: normalizeDateForInput(row?.anniversary),
      referralCode: String(row?.referralCode || ""),
      usedReferralCode: String(row?.usedReferralCode || ""),
      totalEarnedPoints: String(row?.totalEarnedPoints ?? 0),
      totalRedeemedPoints: String(row?.totalRedeemedPoints ?? 0),
      availablePoints: String(row?.availablePoints ?? 0),
    };
    saveCustomerProfile(nextProfile);
  }

  function toggleLoyaltyForProduct(productId) {
    const selected = productOptions.find((item) => String(item.id) === String(productId));
    if (!selected) return;
    setEditingProduct({
      ...selected,
      enableLoyalty: !!selected.enableLoyalty,
      enableCollection: !!selected.enableCollection,
      collectionType: selected.collectionType === "sku" ? "sku" : "points",
      pointsValue: String(selected.pointsValue ?? ""),
      skuValue: String(selected.skuValue ?? ""),
    });
    setIsConfigModalOpen(true);
  }

  function openEditFromEnabledItem(item) {
    setEditingProduct({
      id: String(item.productId || ""),
      name: String(item.productName || ""),
      sku: String(item.sku || ""),
      enableLoyalty: true,
      enableCollection: true,
      collectionType: item.collectionType === "amount" ? "sku" : "points",
      pointsValue: String(item.pointsBased ?? ""),
      skuValue: String(item.skuBased ?? ""),
    });
    setIsConfigModalOpen(true);
  }

  function updateEditingProduct(patch) {
    setEditingProduct((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function loadEnabledItems({ q = enabledItemsSearch, collectionType = enabledItemsFilter } = {}) {
    try {
      setEnabledItemsLoading(true);
      setEnabledItemsError("");

      const params = new URLSearchParams({
        q: String(q || ""),
        collectionType: String(collectionType || "all"),
      });
      const res = await fetch(`/api/loyalty/get-enabled-items?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || "Failed to load enabled loyalty items");
      }

      setEnabledItems(data.items);
    } catch (err) {
      console.error("loadEnabledItems error:", err);
      setEnabledItems([]);
      setEnabledItemsError(err?.message || "Failed to load enabled loyalty items");
    } finally {
      setEnabledItemsLoading(false);
    }
  }

  async function loadItemsTab({ q = itemsTabSearch, type = itemsTabType } = {}) {
    try {
      setItemsTabLoading(true);
      setItemsTabError("");
      const params = new URLSearchParams({
        q: String(q || ""),
        type: String(type || "all"),
      });
      const res = await fetch(`/api/loyalty/get-items?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error || "Failed to load items");
      }
      setItemsTabRows(data.items);
    } catch (error) {
      console.error("loadItemsTab error:", error);
      setItemsTabRows([]);
      setItemsTabError(error?.message || "Failed to load items");
    } finally {
      setItemsTabLoading(false);
    }
  }

  async function loadEvents({ q = eventsSearch } = {}) {
    try {
      setEventsLoading(true);
      setEventsError("");
      const params = new URLSearchParams({ q: String(q || "") });
      const res = await fetch(`/api/loyalty/get-events?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data?.events)) {
        throw new Error(data?.error || "Failed to load events");
      }
      setEventsRows(data.events);
    } catch (error) {
      console.error("loadEvents error:", error);
      setEventsRows([]);
      setEventsError(error?.message || "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }

  async function loadGiftcards({
    email = giftcardsEmailSearch,
    code = giftcardsCodeSearch,
  } = {}) {
    try {
      setGiftcardsLoading(true);
      setGiftcardsError("");

      const params = new URLSearchParams({
        email: String(email || ""),
        code: String(code || ""),
      });
      const res = await fetch(`/api/loyalty/get-giftcards?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !Array.isArray(data?.giftcards)) {
        throw new Error(data?.error || "Failed to load giftcards");
      }

      setGiftcardsRows(data.giftcards);
    } catch (error) {
      console.error("loadGiftcards error:", error);
      setGiftcardsRows([]);
      setGiftcardsError(error?.message || "Failed to load giftcards");
    } finally {
      setGiftcardsLoading(false);
    }
  }

  function exportGiftcardsCsv() {
    const headers = ["Customer", "Email", "Code", "Amount", "Status", "Created"];
    const lines = giftcardsRows.map((row) =>
      [
        row.customerName || "-",
        row.email || "-",
        row.code || "-",
        Number(row.amount || 0).toFixed(2),
        row.status || "-",
        row.created ? String(row.created).slice(0, 10) : "-",
      ]
        .map((value) => `"${String(value).replace(/"/g, "\"\"")}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "giftcards-generated.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadSavedCustomers({ q = customersSearch } = {}) {
    try {
      setCustomersLoading(true);
      setCustomersError("");
      const params = new URLSearchParams({ q: String(q || "") });
      const res = await fetch(`/api/loyalty/get-saved-customers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data?.customers)) {
        throw new Error(data?.error || "Failed to load saved customers");
      }
      setCustomersRows(data.customers);
    } catch (error) {
      console.error("loadSavedCustomers error:", error);
      setCustomersRows([]);
      setCustomersError(error?.message || "Failed to load saved customers");
    } finally {
      setCustomersLoading(false);
    }
  }

  async function saveEvent() {
    try {
      const payload = {
        id: eventForm.id,
        nsId: eventForm.nsId,
        eventId: eventForm.eventId,
        eventName: eventForm.eventName,
        isActive: !!eventForm.isActive,
      };
      if (!payload.eventId.trim() || !payload.eventName.trim()) {
        setEventsError("Event ID and Event Name are required.");
        return;
      }

      setIsEventSaving(true);
      setEventsError("");

      const res = await fetch("/api/loyalty/save-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save event");
      }

      setIsEventModalOpen(false);
      setEventForm({ id: null, nsId: "", eventId: "", eventName: "", isActive: true });
      await loadEvents();
      setEventsPage(1);
    } catch (error) {
      console.error("saveEvent error:", error);
      setEventsError(error?.message || "Failed to save event");
    } finally {
      setIsEventSaving(false);
    }
  }

  function openEditEvent(event) {
    setEventForm({
      id: Number(event.id) || null,
      nsId: String(event.nsId || ""),
      eventId: String(event.eventId || ""),
      eventName: String(event.eventName || ""),
      isActive: !!event.isActive,
    });
    setIsEventModalOpen(true);
  }

  async function toggleEventActive(event) {
    try {
      const nextActive = !event.isActive;
      const res = await fetch("/api/loyalty/save-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          id: event.id,
          nsId: event.nsId || "",
          eventId: event.eventId || "",
          eventName: event.eventName || "",
          isActive: nextActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update event status");
      }
      await loadEvents();
    } catch (error) {
      console.error("toggleEventActive error:", error);
      setEventsError(error?.message || "Failed to update event status");
    }
  }

  function exportEnabledItemsCsv() {
    const headers = [
      "Product ID",
      "Product Name",
      "Eligibility",
      "Collection Type",
      "Points Based",
      "SKU Based",
      "SKU",
    ];
    const lines = enabledItems.map((item) =>
      [
        item.productId,
        item.productName,
        item.eligibility,
        item.collectionType,
        item.pointsBased,
        item.skuBased,
        item.sku,
      ]
        .map((value) => {
          const safe = String(value ?? "").replace(/"/g, "\"\"");
          return `"${safe}"`;
        })
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enabled-loyalty-items.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportItemsTabCsv() {
    const headers = ["Product ID", "Name", "Eligibility", "Type", "Points"];
    const lines = itemsTabRows.map((item) =>
      [
        item.productId,
        item.productName,
        item.eligibility ? "Yes" : "No",
        item.typeLabel,
        item.points,
      ]
        .map((value) => {
          const safe = String(value ?? "").replace(/"/g, "\"\"");
          return `"${safe}"`;
        })
        .join(",")
    );

    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loyalty-items.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveProductConfig() {
    const product = editingProduct;
    if (!product) return;

    try {
      setIsConfigSaving(true);
      setProductOptionsError("");
      setProductOptionsInfo("");

      const payload = {
        productId: product.id,
        productName: product.name || "",
        productSku: product.sku || "",
        enableLoyalty: !!product.enableLoyalty,
        enableCollection: !!product.enableCollection,
        collectionType: product.collectionType === "sku" ? "amount" : "points",
        pointsValue: product.collectionType === "points" ? product.pointsValue || 0 : 0,
        skuMultiplier: product.collectionType === "sku" ? product.skuValue || 0 : 0,
        type: user?.type || "",
        licenseKey: user?.licenseKey || "",
        username: user?.username || "",
        productCode: user?.productCode || "",
      };

      const res = await fetch("/api/loyalty/save-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Failed to save product config");
      }

      setProductOptionsInfo(`Saved product ${product.id} successfully.`);
      setProductOptions((prev) =>
        prev.map((item) =>
          String(item.id) === String(product.id)
            ? {
                ...item,
                enableLoyalty: !!product.enableLoyalty,
                enableCollection: !!product.enableCollection,
                collectionType: product.collectionType === "sku" ? "sku" : "points",
                pointsValue: String(product.pointsValue ?? ""),
                skuValue: String(product.skuValue ?? ""),
              }
            : item
        )
      );
      await loadEnabledItems();
      setIsConfigModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      setProductOptionsError(err?.message || "Failed to save product config");
    } finally {
      setIsConfigSaving(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadSavedCustomers();
      loadEnabledItems();
      loadItemsTab();
      loadEvents();
      loadGiftcards();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => {
      loadEvents({ q: eventsSearch });
      setEventsPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [eventsSearch, user]);

  useEffect(() => {
    if (!user || !showEnabledItemsTable) return;
    const timeoutId = setTimeout(() => {
      loadEnabledItems({ q: enabledItemsSearch, collectionType: enabledItemsFilter });
      setEnabledItemsPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [enabledItemsSearch, enabledItemsFilter, showEnabledItemsTable, user]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => {
      loadSavedCustomers({ q: customersSearch });
      setCustomersPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [customersSearch, user]);

  useEffect(() => {
    if (!isCustomerPickerOpen) return;
    const timeoutId = setTimeout(() => {
      loadCustomerCandidates({ q: customerCandidatesSearch });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [customerCandidatesSearch, isCustomerPickerOpen]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => {
      loadItemsTab({ q: itemsTabSearch, type: itemsTabType });
      setItemsPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [itemsTabSearch, itemsTabType, user]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(() => {
      loadGiftcards({ email: giftcardsEmailSearch, code: giftcardsCodeSearch });
      setGiftcardsPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [giftcardsEmailSearch, giftcardsCodeSearch, user]);

  /* ---------------- Panels ---------------- */

  const customersPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.title}>Loyalty Customers</h2>

      <div style={ui.tools}>
        <div style={ui.group}>
          <ButtonGroup>
            <Button variant="primary" onClick={openCustomerPicker}>
              Select Shopify Customer
            </Button>
          </ButtonGroup>
          <div style={ui.fieldWrap}>
            <TextField
              label="Search saved customers"
              labelHidden
              value={customersSearch}
              placeholder="Search by ID, name, or email"
              autoComplete="off"
              onChange={setCustomersSearch}
            />
          </div>
          <ButtonGroup>
            <Button onClick={downloadAllCustomersCsv} disabled={!customersRows.length}>
              Download CSV
            </Button>
          </ButtonGroup>
        </div>

        <Badge tone={customersRows.length ? "success" : "info"}>
          {customersLoading ? "Loading..." : `${customersRows.length} customer(s)`}
        </Badge>
      </div>

      {customersError && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="critical">
            <p>{customersError}</p>
          </Banner>
        </div>
      )}
      {!customersError && customersInfo && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="success">
            <p>{customersInfo}</p>
          </Banner>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Button
          variant={customerSectionTab === "customers" ? "primary" : "secondary"}
          onClick={() => setCustomerSectionTab("customers")}
        >
          Customer List
        </Button>
        <Button
          variant={customerSectionTab === "add-customer-event" ? "primary" : "secondary"}
          onClick={() => setCustomerSectionTab("add-customer-event")}
        >
          Add Customer Event
        </Button>
      </div>

      {customerSectionTab === "customers" ? (
        <PaginatedTable
          columns={[
            "S.No",
            "Name",
            "Email",
            "Total Earned Points",
            "Total Redeemed Points",
            "Available Points",
            "Edit",
            "Eligible?",
            "View",
          ]}
          rows={customersRows.map((row, index) => [
            String(index + 1),
            row.name || "-",
            row.email || "-",
            Number(row.totalEarnedPoints || 0).toFixed(2),
            Number(row.totalRedeemedPoints || 0).toFixed(2),
            Number(row.availablePoints || 0).toFixed(2),
            <Button size="slim" onClick={() => openCustomerEditModal(row)}>
              Edit
            </Button>,
            <label key={`eligible-${row.id}`} className="events-switch-wrap">
              <input
                className="events-switch-input"
                type="checkbox"
                checked={!!row.eligibleForLoyalty}
                onChange={() => toggleCustomerEligible(row)}
              />
              <span className="events-switch-slider" />
            </label>,
            <Button size="slim" onClick={() => openCustomerViewModal(row)}>
              View
            </Button>,
          ])}
          page={customersPage}
          setPage={setCustomersPage}
          perPage={customersPerPage}
          setPerPage={setCustomersPerPage}
        />
      ) : (
        <PaginatedTable
          columns={[
            "S.No",
            "Name",
            "Email",
            "Available Points",
            "Add Customer Event",
          ]}
          rows={customersRows.map((row, index) => [
            String(index + 1),
            row.name || "-",
            row.email || "-",
            Number(row.availablePoints || 0).toFixed(2),
            <Button size="slim" onClick={() => openCustomerEventModal(row)}>
              Add Customer Event
            </Button>,
          ])}
          page={customersPage}
          setPage={setCustomersPage}
          perPage={customersPerPage}
          setPerPage={setCustomersPerPage}
          emptyLabel="No customers available to add events"
        />
      )}

      <Modal
        open={isCustomerPickerOpen}
        onClose={() => {
          setIsCustomerPickerOpen(false);
          setSelectedCustomerIds([]);
          setCustomerCandidatesSearch("");
        }}
        title="Add customers"
        primaryAction={{
          content: "Add",
          onAction: saveSelectedCandidateCustomers,
          disabled: !selectedCustomerIds.length,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setIsCustomerPickerOpen(false);
              setSelectedCustomerIds([]);
              setCustomerCandidatesSearch("");
            },
          },
        ]}
      >
        <Modal.Section>
          <div style={{ marginBottom: 12 }}>
            <TextField
              label="Search customers"
              labelHidden
              value={customerCandidatesSearch}
              placeholder="Search by customer name or email"
              autoComplete="off"
              onChange={setCustomerCandidatesSearch}
            />
          </div>

          <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid #d9e4f7", borderRadius: 10 }}>
            {customerCandidatesLoading ? (
              <div style={{ padding: 12, color: "#64748b", fontSize: 14 }}>Loading customers...</div>
            ) : !customerCandidates.length ? (
              <div style={{ padding: 12, color: "#64748b", fontSize: 14 }}>No customers found.</div>
            ) : (
              customerCandidates.map((row, index) => {
                const checked = selectedCustomerIds.includes(String(row.id));
                return (
                  <label
                    key={`${row.id}-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderBottom: "1px solid #edf2fb",
                      background: checked ? "#eef6ff" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCandidateCustomer(String(row.id))}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{row.name || "-"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        ID: {row.id || "-"}{row.email ? ` | ${row.email}` : ""}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </Modal.Section>
      </Modal>

      <Modal
        open={isCustomerEditModalOpen}
        onClose={() => {
          if (isCustomerProfileSaving) return;
          setIsCustomerEditModalOpen(false);
          setEditingCustomer(null);
        }}
        title="Edit customer loyalty profile"
        primaryAction={{
          content: isCustomerProfileSaving ? "Saving..." : "Save",
          onAction: () => saveCustomerProfile(),
          loading: isCustomerProfileSaving,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              if (isCustomerProfileSaving) return;
              setIsCustomerEditModalOpen(false);
              setEditingCustomer(null);
            },
          },
        ]}
      >
        <Modal.Section>
          {!editingCustomer ? (
            <Text as="p" variant="bodyMd">No customer selected.</Text>
          ) : (
            <FormLayout>
              <TextField
                label="Customer ID"
                value={editingCustomer.id || ""}
                readOnly
                autoComplete="off"
              />
              <TextField
                label="Customer Name"
                value={editingCustomer.name || ""}
                readOnly
                autoComplete="off"
              />
              <TextField
                label="Email"
                value={editingCustomer.email || ""}
                readOnly
                autoComplete="off"
              />

              <div className="event-modal-toggle-row">
                <Text as="p" variant="bodyMd">Customer eligible for loyalty</Text>
                <label className="events-switch-wrap">
                  <input
                    className="events-switch-input"
                    type="checkbox"
                    checked={!!editingCustomer.eligibleForLoyalty}
                    onChange={(e) =>
                      setEditingCustomer((prev) =>
                        prev ? { ...prev, eligibleForLoyalty: e.target.checked } : prev
                      )
                    }
                  />
                  <span className="events-switch-slider" />
                </label>
              </div>

              <TextField
                label="Birthday"
                type="date"
                value={editingCustomer.birthday || ""}
                autoComplete="off"
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, birthday: value } : prev))
                }
              />
              <TextField
                label="Anniversary"
                type="date"
                value={editingCustomer.anniversary || ""}
                autoComplete="off"
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, anniversary: value } : prev))
                }
              />
              <TextField
                label="Customer referral code"
                value={editingCustomer.referralCode || ""}
                autoComplete="off"
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, referralCode: value } : prev))
                }
              />
              <TextField
                label="Used friend's referral code"
                value={editingCustomer.usedReferralCode || ""}
                autoComplete="off"
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, usedReferralCode: value } : prev))
                }
              />
              <TextField
                label="Total Earned Points"
                type="number"
                autoComplete="off"
                value={editingCustomer.totalEarnedPoints || "0"}
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, totalEarnedPoints: value } : prev))
                }
              />
              <TextField
                label="Total Redeemed Points"
                type="number"
                autoComplete="off"
                value={editingCustomer.totalRedeemedPoints || "0"}
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, totalRedeemedPoints: value } : prev))
                }
              />
              <TextField
                label="Available Points"
                type="number"
                autoComplete="off"
                value={editingCustomer.availablePoints || "0"}
                onChange={(value) =>
                  setEditingCustomer((prev) => (prev ? { ...prev, availablePoints: value } : prev))
                }
              />
            </FormLayout>
          )}
        </Modal.Section>
      </Modal>

      <Modal
        open={isCustomerEventModalOpen}
        onClose={() => {
          if (isCustomerEventSaving) return;
          setIsCustomerEventModalOpen(false);
          setCustomerEventTarget(null);
          resetCustomerEventForm();
        }}
        title="Add customer event"
        primaryAction={{
          content: isCustomerEventSaving ? "Saving..." : "Save",
          onAction: saveCustomerEvent,
          loading: isCustomerEventSaving,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              if (isCustomerEventSaving) return;
              setIsCustomerEventModalOpen(false);
              setCustomerEventTarget(null);
              resetCustomerEventForm();
            },
          },
        ]}
      >
        <Modal.Section>
          {!customerEventTarget ? (
            <Text as="p" variant="bodyMd">No customer selected.</Text>
          ) : (
            <FormLayout>
              <TextField
                label="Customer Name"
                value={customerEventTarget.name || ""}
                readOnly
                autoComplete="off"
              />
              <TextField
                label="Customer Email"
                value={customerEventTarget.email || ""}
                readOnly
                autoComplete="off"
              />
              <Select
                label="Event"
                options={[
                  { label: "Select an event", value: "" },
                  ...eventsRows
                    .filter((event) => !!event.isActive)
                    .map((event) => ({
                      label: `${event.eventName || "Event"} (${event.eventId || "-"})`,
                      value: String(event.eventId || ""),
                    })),
                ]}
                value={customerEventForm.eventId}
                onChange={(value) => {
                  const selectedEvent = eventsRows.find(
                    (event) => String(event.eventId || "") === String(value)
                  );
                  setCustomerEventForm((prev) => ({
                    ...prev,
                    eventId: value,
                    eventName: selectedEvent?.eventName || prev.eventName,
                  }));
                }}
              />
              <TextField
                label="Event Name"
                value={customerEventForm.eventName}
                autoComplete="off"
                onChange={(value) =>
                  setCustomerEventForm((prev) => ({ ...prev, eventName: value }))
                }
              />
              <Select
                label="Points Type"
                options={[
                  { label: "Positive (award points)", value: "positive" },
                  { label: "Negative (redeem/deduct points)", value: "negative" },
                ]}
                value={customerEventForm.pointsType}
                onChange={(value) =>
                  setCustomerEventForm((prev) => ({ ...prev, pointsType: value }))
                }
              />
              <TextField
                label="Points Value"
                type="number"
                autoComplete="off"
                value={customerEventForm.pointsValue}
                onChange={(value) =>
                  setCustomerEventForm((prev) => ({ ...prev, pointsValue: value }))
                }
              />
              <TextField
                label="Amount"
                type="number"
                autoComplete="off"
                value={customerEventForm.amount}
                onChange={(value) =>
                  setCustomerEventForm((prev) => ({ ...prev, amount: value }))
                }
              />
              <TextField
                label="Date"
                type="date"
                autoComplete="off"
                value={customerEventForm.dateCreated}
                onChange={(value) =>
                  setCustomerEventForm((prev) => ({ ...prev, dateCreated: value }))
                }
              />
              <TextField
                label="Comments"
                multiline={3}
                autoComplete="off"
                value={customerEventForm.comments}
                onChange={(value) =>
                  setCustomerEventForm((prev) => ({ ...prev, comments: value }))
                }
              />
            </FormLayout>
          )}
        </Modal.Section>
      </Modal>

      <Modal
        open={isCustomerViewModalOpen}
        onClose={() => {
          setIsCustomerViewModalOpen(false);
          setViewingCustomer(null);
          setViewingCustomerEvents([]);
          setViewingCustomerEventsError("");
        }}
        size="large"
        title="Customer event details"
        primaryAction={{
          content: "Download CSV",
          onAction: () => downloadSingleCustomerCsv(viewingCustomer, viewingCustomerEvents),
          disabled: !viewingCustomerEvents.length,
        }}
        secondaryActions={[
          {
            content: "Close",
            onAction: () => {
              setIsCustomerViewModalOpen(false);
              setViewingCustomer(null);
              setViewingCustomerEvents([]);
              setViewingCustomerEventsError("");
            },
          },
        ]}
      >
        <Modal.Section>
          {!viewingCustomer ? (
            <Text as="p" variant="bodyMd">No customer selected.</Text>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <Text as="p" variant="bodyMd"><strong>ID:</strong> {viewingCustomer.id || "-"}</Text>
                <Text as="p" variant="bodyMd"><strong>Name:</strong> {viewingCustomer.name || "-"}</Text>
                <Text as="p" variant="bodyMd"><strong>Email:</strong> {viewingCustomer.email || "-"}</Text>
              </div>

              {viewingCustomerEventsError ? (
                <Banner tone="critical">
                  <p>{viewingCustomerEventsError}</p>
                </Banner>
              ) : null}

              {viewingCustomerEventsLoading ? (
                <Text as="p" variant="bodyMd">Loading event history...</Text>
              ) : viewingCustomerEvents.length ? (
                <Table
                  columns={[
                    "Date",
                    "Event Name",
                    "Amount",
                    "Points Earned",
                    "Points Redeemed",
                    "Points Left",
                  ]}
                  rows={viewingCustomerEvents.map((event) => [
                    event.date ? String(event.date).slice(0, 10) : "-",
                    event.eventName || "-",
                    Number(event.amount || 0).toFixed(2),
                    Number(event.pointsEarned || 0).toFixed(2),
                    Number(event.pointsRedeemed || 0).toFixed(2),
                    Number(event.pointsLeft || 0).toFixed(2),
                  ])}
                  emptyLabel="No event history found"
                />
              ) : (
                <Text as="p" variant="bodyMd">No event history found for this customer.</Text>
              )}
            </div>
          )}
        </Modal.Section>
      </Modal>
    </LegacyCard>
  );

  const eventsPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.title}>Events</h2>

      <div style={ui.tools}>
        <div style={ui.group}>
          <div style={ui.fieldWrap}>
            <TextField
              label="Search by Event ID or Event Name"
              labelHidden
              value={eventsSearch}
              placeholder="Search by Event ID or Event Name"
              autoComplete="off"
              onChange={setEventsSearch}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text as="span" variant="bodySm" tone="subdued">
            {eventsLoading ? "Loading..." : `${eventsRows.length} event(s)`}
          </Text>
          <Button variant="primary" onClick={() => setIsEventModalOpen(true)}>
            Add Event
          </Button>
        </div>
      </div>

      {eventsError && (
        <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 14 }}>{eventsError}</div>
      )}

      <PaginatedTable
        columns={
          user?.type === "netsuite"
            ? ["ID", "NS ID", "Event ID", "Event Name", "Is Active"]
            : ["ID", "Event ID", "Event Name", "Is Active", "Actions"]
        }
        rows={eventsRows.map((event) =>
          user?.type === "netsuite"
            ? [
                String(event.id || "-"),
                event.nsId || "-",
                event.eventId || "-",
                event.eventName || "-",
                <label key={`event-active-${event.id}`} className="events-switch-wrap">
                  <input
                    className="events-switch-input"
                    type="checkbox"
                    checked={!!event.isActive}
                    onChange={() => toggleEventActive(event)}
                  />
                  <span className="events-switch-slider" />
                </label>,
              ]
            : [
                String(event.id || "-"),
                event.eventId || "-",
                event.eventName || "-",
                <label key={`event-active-${event.id}`} className="events-switch-wrap">
                  <input
                    className="events-switch-input"
                    type="checkbox"
                    checked={!!event.isActive}
                    onChange={() => toggleEventActive(event)}
                  />
                  <span className="events-switch-slider" />
                </label>,
                <button
                  key={`event-edit-${event.id}`}
                  type="button"
                  className="table-edit-btn"
                  onClick={() => openEditEvent(event)}
                  title="Edit event"
                  aria-label="Edit event"
                >
                  <svg viewBox="0 0 24 24" className="table-edit-icon" aria-hidden="true">
                    <path d="M4 20h4l10-10-4-4L4 16v4z" />
                    <path d="M13 7l4 4" />
                  </svg>
                </button>,
              ]
        )}
        page={eventsPage}
        setPage={setEventsPage}
        perPage={eventsPerPage}
        setPerPage={setEventsPerPage}
      />

      <Modal
        open={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEventForm({ id: null, nsId: "", eventId: "", eventName: "", isActive: true });
        }}
        title={eventForm.id ? "Edit Event" : "Add Event"}
        primaryAction={{
          content: isEventSaving ? "Saving..." : "Save",
          onAction: saveEvent,
          loading: isEventSaving,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setIsEventModalOpen(false);
              setEventForm({ id: null, nsId: "", eventId: "", eventName: "", isActive: true });
            },
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            {user?.type === "netsuite" && (
              <TextField
                label="NS ID"
                autoComplete="off"
                value={eventForm.nsId}
                onChange={(value) => setEventForm((prev) => ({ ...prev, nsId: value }))}
              />
            )}
            <TextField
              label="Event ID"
              autoComplete="off"
              value={eventForm.eventId}
              onChange={(value) => setEventForm((prev) => ({ ...prev, eventId: value }))}
            />
            <TextField
              label="Event Name"
              autoComplete="off"
              value={eventForm.eventName}
              onChange={(value) => setEventForm((prev) => ({ ...prev, eventName: value }))}
            />
            <div className="event-modal-toggle-row">
              <Text as="p" variant="bodyMd">Is Active</Text>
              <label className="events-switch-wrap">
                <input
                  className="events-switch-input"
                  type="checkbox"
                  checked={!!eventForm.isActive}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />
                <span className="events-switch-slider" />
              </label>
            </div>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </LegacyCard>
  );

  const itemsPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.title}>Items</h2>

      <div style={ui.tools}>
        <div style={ui.group}>
          <div style={ui.fieldWrap}>
            <TextField
              label="Search by Product ID or Name"
              labelHidden
              value={itemsTabSearch}
              placeholder="Search by Product ID or Name"
              autoComplete="off"
              onChange={setItemsTabSearch}
            />
          </div>

          <div style={ui.fieldSelectWrap}>
            <Select
              label="Type"
              labelHidden
              options={[
                { label: "All types", value: "all" },
                { label: "Points", value: "points" },
                { label: "SKU", value: "amount" },
              ]}
              value={itemsTabType}
              onChange={setItemsTabType}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Text as="span" variant="bodySm" tone="subdued">
            {itemsTabLoading ? "Loading..." : `${itemsTabRows.length} item(s)`}
          </Text>
          <Button
            variant="primary"
            onClick={exportItemsTabCsv}
            disabled={!itemsTabRows.length}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {itemsTabError && (
        <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 14 }}>{itemsTabError}</div>
      )}

      <PaginatedTable
        columns={[
          "Product ID",
          "Name",
          "Eligibility",
          "Type",
          "Points",
        ]}
        rows={itemsTabRows.map((item) => [
          item.productId || "-",
          item.productName || "-",
          item.eligibility ? "Yes" : "No",
          item.typeLabel || "-",
          String(item.points ?? 0),
        ])}
        page={itemsPage}
        setPage={setItemsPage}
        perPage={itemsPerPage}
        setPerPage={setItemsPerPage}
      />
    </LegacyCard>
  );

  const giftcardPanel = (
    <LegacyCard sectioned>
      <h2 style={ui.title}>Giftcards</h2>

      <div style={ui.tools}>
        <div style={ui.group}>
          <input
            style={ui.input}
            placeholder="Email"
            value={giftcardsEmailSearch}
            onChange={(event) => setGiftcardsEmailSearch(event.target.value)}
          />

          <input
            style={ui.input}
            placeholder="Code"
            value={giftcardsCodeSearch}
            onChange={(event) => setGiftcardsCodeSearch(event.target.value)}
          />

          <Button onClick={() => {
            loadGiftcards({ email: giftcardsEmailSearch, code: giftcardsCodeSearch });
            setGiftcardsPage(1);
          }}>
            Filter
          </Button>
        </div>

        <Button variant="primary" onClick={exportGiftcardsCsv} disabled={!giftcardsRows.length}>
          Export CSV
        </Button>
      </div>

      {giftcardsError ? (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="critical">
            <p>{giftcardsError}</p>
          </Banner>
        </div>
      ) : null}

      <PaginatedTable
        columns={[
          "User Name",
          "Email",
          "Code",
          "Amount",
          "Status",
          "Created",
        ]}
        rows={giftcardsRows.map((row) => [
          row.customerName || "-",
          row.email || "-",
          row.code || "-",
          Number(row.amount || 0).toFixed(2),
          row.status || "-",
          row.created ? String(row.created).slice(0, 10) : "-",
        ])}
        page={giftcardsPage}
        setPage={setGiftcardsPage}
        perPage={giftcardsPerPage}
        setPerPage={setGiftcardsPerPage}
        emptyLabel={giftcardsLoading ? "Loading giftcards..." : "No records to display"}
      />
    </LegacyCard>
  );

  const loyaltyConfigPanel = (
    <div style={ui.sectionStack}>
      <LegacyCard sectioned>
        <div style={ui.sectionHeaderRow}>
          <div>
            <h2 style={ui.sectionTitle}>Loyalty Products</h2>
            {/* <p style={ui.sectionSubtitle}>
              Search and select products from Shopify to configure loyalty settings.
            </p> */}
          </div>
          <div style={ui.statPill}>Search Results: {productOptions.length}</div>
        </div>

        <div style={ui.tools}>
          <div style={ui.group}>
            <Button variant="primary" onClick={openProductPicker}>
              Select Shopify Product
            </Button>
          </div>
        </div>

        {productOptionsError && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#b91c1c", fontSize: 14 }}>{productOptionsError}</div>
          </div>
        )}
        {!productOptionsError && productOptionsInfo && (
          <div style={{ marginBottom: 12, color: "#92400e", fontSize: 14 }}>{productOptionsInfo}</div>
        )}

        <PaginatedTable
          columns={["Product Name", "Product ID", "SKU", "Enable Loyalty"]}
          rows={productOptions.map((item) => [
            item.name || "-",
            item.id || "-",
            item.sku || "-",
            <label key={`toggle-${item.id}`} className="loyalty-switch-wrap">
              <input
                className="loyalty-switch-input"
                type="checkbox"
                checked={!!item.enableLoyalty}
                onChange={() => toggleLoyaltyForProduct(item.id)}
              />
              <span className="loyalty-switch-slider" />
              <span className="loyalty-switch-text">{item.enableLoyalty ? "Enabled" : "Disabled"}</span>
            </label>,
          ])}
          page={loyaltyProductsPage}
          setPage={setLoyaltyProductsPage}
          perPage={loyaltyProductsPerPage}
          setPerPage={null}
          // setPerPage={setLoyaltyProductsPerPage}
        />
      </LegacyCard>

      <LegacyCard sectioned>
        <div style={ui.sectionHeaderRow}>
          <div>
            <h2 style={ui.sectionTitle}>loyalty eligible products</h2>
            <p style={ui.sectionSubtitle}>
              View and export eligible products.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={ui.statPill}>Eligible Products: {enabledItems.length}</div>
            <button
              type="button"
              className={`eye-toggle-btn ${showEnabledItemsTable ? "active" : "inactive"}`}
              onClick={() => setShowEnabledItemsTable((prev) => !prev)}
              aria-label={showEnabledItemsTable ? "Hide enabled products table" : "Show enabled products table"}
              title={showEnabledItemsTable ? "Hide table" : "Show table"}
            >
              <svg className="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12C4.2 8 7.7 6 12 6s7.8 2 10 6c-2.2 4-5.7 6-10 6s-7.8-2-10-6z" />
                <circle cx="12" cy="12" r="3.2" />
                {!showEnabledItemsTable && <path d="M4 20L20 4" />}
              </svg>
            </button>
          </div>
        </div>

        {showEnabledItemsTable && (
          <>
            <div style={ui.tools}>
              <div style={ui.group}>
                <div style={ui.fieldWrap}>
                  <TextField
                    label="Search by Product ID or Name"
                    labelHidden
                    value={enabledItemsSearch}
                    placeholder="Search by Product ID or Name"
                    autoComplete="off"
                    onChange={setEnabledItemsSearch}
                  />
                </div>

                <div style={ui.fieldSelectWrap}>
                  <Select
                    label="Collection type"
                    labelHidden
                    options={[
                      { label: "All collection types", value: "all" },
                      { label: "Points based", value: "points" },
                      { label: "SKU based", value: "amount" },
                    ]}
                    value={enabledItemsFilter}
                    onChange={setEnabledItemsFilter}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Text as="span" variant="bodySm" tone="subdued">
                  {enabledItems.length} item(s)
                </Text>
                <Button variant="primary" onClick={exportEnabledItemsCsv} disabled={!enabledItems.length}>
                  Export CSV
                </Button>
              </div>
            </div>

            {enabledItemsError && (
              <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 14 }}>{enabledItemsError}</div>
            )}

            <PaginatedTable
              columns={[
                "Product Name",
                "Product ID",
                "Eligibility",
                "Collection Type",
                "Points Based",
                "SKU Based",
                "Actions",
              ]}
              rows={enabledItems.map((item) => [
                item.productName || "-",
                item.productId || "-",
                <span className="yes-pill" key={`yes-${item.productId}`}>Yes</span>,
                item.collectionType === "amount" ? "SKU based" : "Points based",
                String(item.pointsBased ?? 0),
                String(item.skuBased ?? 0),
                <button
                  key={`edit-${item.productId}`}
                  type="button"
                  className="table-edit-btn"
                  onClick={() => openEditFromEnabledItem(item)}
                  title="Edit loyalty settings"
                  aria-label="Edit loyalty settings"
                >
                  <svg viewBox="0 0 24 24" className="table-edit-icon" aria-hidden="true">
                    <path d="M4 20h4l10-10-4-4L4 16v4z" />
                    <path d="M13 7l4 4" />
                  </svg>
                </button>,
              ])}
              page={enabledItemsPage}
              setPage={setEnabledItemsPage}
              perPage={enabledItemsPerPage}
              setPerPage={setEnabledItemsPerPage}
            />
          </>
        )}
      </LegacyCard>

      {(() => {
        const product = editingProduct;
        return (
          <Modal
            open={isConfigModalOpen}
            onClose={() => {
              setIsConfigModalOpen(false);
              setEditingProduct(null);
            }}
            title="Configure Loyalty Product"
            primaryAction={{
              content: isConfigSaving ? "Saving..." : "Save",
              onAction: saveProductConfig,
              loading: isConfigSaving,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: () => {
                  setIsConfigModalOpen(false);
                  setEditingProduct(null);
                },
              },
            ]}
          >
            <Modal.Section>
              {!product ? (
                <Text as="p" variant="bodyMd">
                  No product selected.
                </Text>
              ) : (
                <div className="config-modal-shell">
                  <div className="config-modal-meta">
                    <p className="product-name-highlight">{product.name || "Untitled Product"}</p>
                    <p className="product-id-highlight">
                      Product ID: <span>{product.id}</span>
                    </p>
                    {/* <p className="product-sku-highlight">
                      SKU: <span>{product.sku || "-"}</span>
                    </p> */}
                  </div>

                  <FormLayout>
                    <div className="config-toggle-row">
                      <Text as="p" variant="bodyMd">Enable loyalty for this product</Text>
                      <label className="config-toggle-wrap">
                        <input
                          className="config-toggle-input"
                          type="checkbox"
                          checked={!!product.enableLoyalty}
                          onChange={(e) => updateEditingProduct({ enableLoyalty: e.target.checked })}
                        />
                        <span className="config-toggle-slider" />
                      </label>
                    </div>

                    {product.enableLoyalty && (
                      <div className="config-toggle-row">
                        <Text as="p" variant="bodyMd">Enable collection type</Text>
                        <label className="config-toggle-wrap">
                          <input
                            className="config-toggle-input"
                            type="checkbox"
                            checked={!!product.enableCollection}
                            onChange={(e) => updateEditingProduct({ enableCollection: e.target.checked })}
                          />
                          <span className="config-toggle-slider" />
                        </label>
                      </div>
                    )}

                    {product.enableLoyalty && product.enableCollection && (
                      <>
                        <Select
                          label="Collection type"
                          options={[
                            { label: "Points based", value: "points" },
                            { label: "SKU based", value: "sku" },
                          ]}
                          value={product.collectionType || "points"}
                          onChange={(value) => updateEditingProduct({ collectionType: value })}
                        />

                        {product.collectionType === "points" && (
                          <TextField
                            label="Points decimal value"
                            type="number"
                            step={0.01}
                            autoComplete="off"
                            value={String(product.pointsValue || "")}
                            onChange={(value) => updateEditingProduct({ pointsValue: value })}
                          />
                        )}

                        {product.collectionType === "sku" && (
                          <TextField
                            label="SKU decimal value"
                            type="number"
                            step={0.01}
                            autoComplete="off"
                            value={String(product.skuValue || "")}
                            onChange={(value) => updateEditingProduct({ skuValue: value })}
                          />
                        )}
                      </>
                    )}
                  </FormLayout>
                </div>
              )}
            </Modal.Section>
          </Modal>
        );
      })()}
    </div>
  );

  const panels = [
    customersPanel,
    eventsPanel,
    itemsPanel,
    giftcardPanel,
    loyaltyConfigPanel,
  ];

  /* ---------------- Loading ---------------- */

  if (user === undefined) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <p>Redirecting...</p>;
  }

  if (isExpired) {
    return (
      <Page title="NetScore Loyalty Rewards">
        <div className="loyalty-data-theme" style={ui.wrap}>
          <LegacyCard sectioned>
            <Banner tone="critical">
              <p>Your license has expired.</p>
              {planEnd && (
                <p>
                  Ended on {planEnd.toISOString().split("T")[0]}
                </p>
              )}
              <p>Please renew your license to access all tabs.</p>
            </Banner>
          </LegacyCard>
        </div>
      </Page>
    );
  }

  /* ---------------- Render ---------------- */

  return (
    <Page title="NetScore Loyalty Rewards">
      <div className="loyalty-data-theme" style={ui.wrap}>

        {/* License Warning */}
        {isExpired && (
          <LegacyCard sectioned>
            <Banner tone="critical">
              <p>Your license has expired.</p>
              {planEnd && (
                <p>
                  Ended on{" "}
                  {planEnd
                    .toISOString()
                    .split("T")[0]}
                </p>
              )}
            </Banner>
          </LegacyCard>
        )}

        {/* Content */}
        <div>
          {panels[activeTab]}
        </div>

      </div>
      <style jsx global>{`
        .loyalty-data-theme .Polaris-LegacyCard {
          border: 1px solid #d4e1f6;
          border-radius: 14px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }

        .loyalty-data-theme .Polaris-LegacyCard__Section {
          padding: 18px;
        }

        .loyalty-data-theme .Polaris-Tabs__TabContainer {
          gap: 8px;
        }

        .loyalty-data-theme .Polaris-Tabs__Tab {
          border-radius: 10px;
          border: 1px solid #dbe5f5;
          background: #ffffff;
          min-height: 36px;
          font-weight: 600;
        }

        .loyalty-data-theme .Polaris-Tabs__Tab--active,
        .loyalty-data-theme .Polaris-Tabs__Tab[aria-selected='true'] {
          color: #ffffff !important;
          border-color: #1d4ed8;
          background: linear-gradient(120deg, #1d4ed8 0%, #0f766e 100%);
          box-shadow: 0 8px 16px rgba(29, 78, 216, 0.24);
        }

        .loyalty-data-theme .Polaris-Tabs__Tab--active span,
        .loyalty-data-theme .Polaris-Tabs__Tab[aria-selected='true'] span {
          color: #ffffff !important;
        }

        .loyalty-data-theme .Polaris-TextField {
          border-color: #cfdcf3;
          border-radius: 10px;
          background: #ffffff;
        }

        .loyalty-data-theme .Polaris-TextField:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
        }

        .loyalty-data-theme .Polaris-Button--variantPrimary {
          background: linear-gradient(120deg, #2563eb 0%, #0f766e 100%);
          border-color: transparent;
          box-shadow: 0 8px 16px rgba(37, 99, 235, 0.22);
        }

        .loyalty-data-theme .Polaris-Button--variantPrimary:hover {
          filter: brightness(0.98);
        }

        .loyalty-data-theme .eye-toggle-btn {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid #f5b2b2;
          background: #fff1f1;
          color: #b42323;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.08);
        }

        .loyalty-data-theme .eye-toggle-btn.inactive:hover {
          background: #ffe5e5;
        }

        .loyalty-data-theme .eye-toggle-btn.active {
          border-color: #72c59e;
          background: #e7f8ef;
          color: #0f6f43;
        }

        .loyalty-data-theme .eye-toggle-btn.active:hover {
          background: #dcf4e8;
        }

        .loyalty-data-theme .eye-icon {
          width: 16px;
          height: 16px;
        }

        .loyalty-data-theme .eye-icon path,
        .loyalty-data-theme .eye-icon circle {
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .loyalty-data-theme .loyalty-switch-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }

        .loyalty-data-theme .loyalty-switch-input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .loyalty-data-theme .loyalty-switch-slider {
          width: 40px;
          height: 22px;
          border-radius: 999px;
          background: #cbd5e1;
          border: 1px solid #b7c4d8;
          position: relative;
          transition: all 160ms ease;
        }

        .loyalty-data-theme .loyalty-switch-slider::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          transition: all 160ms ease;
        }

        .loyalty-data-theme .loyalty-switch-input:checked + .loyalty-switch-slider {
          background: linear-gradient(120deg, #2563eb 0%, #0f766e 100%);
          border-color: transparent;
        }

        .loyalty-data-theme .loyalty-switch-input:checked + .loyalty-switch-slider::after {
          transform: translateX(18px);
        }

        .loyalty-data-theme .loyalty-switch-text {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .loyalty-data-theme .yes-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          height: 24px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid #8bd3b6;
          background: #e7f8ef;
          color: #0f6f43;
          font-size: 12px;
          font-weight: 700;
        }

        .loyalty-data-theme .table-edit-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid #cad8f2;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .loyalty-data-theme .table-edit-btn:hover {
          background: #f2f7ff;
          border-color: #a8c0ea;
        }

        .loyalty-data-theme .table-edit-icon {
          width: 15px;
          height: 15px;
        }

        .loyalty-data-theme .table-edit-icon path {
          fill: none;
          stroke: #1e3a8a;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .Polaris-Modal-Dialog__Modal {
          border-radius: 16px;
          border: 1px solid #d2e0f7;
          box-shadow: 0 20px 46px rgba(15, 23, 42, 0.24);
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        }

        .Polaris-Modal-Header {
          border-bottom: 1px solid #e0eaf8;
          background: linear-gradient(180deg, #f2f7ff 0%, #fbfdff 100%);
        }

        .Polaris-Modal-Footer {
          border-top: 1px solid #e0eaf8;
          background: #fbfdff;
        }

        .Polaris-Modal-Footer .Polaris-ButtonGroup__Item:last-child .Polaris-Button,
        .Polaris-Modal-Footer .Polaris-Button--variantPrimary {
          background: linear-gradient(120deg, #2563eb 0%, #0f766e 100%) !important;
          border: 1px solid #1f5ccc !important;
          color: #ffffff !important;
          box-shadow: 0 8px 16px rgba(37, 99, 235, 0.24) !important;
          border-radius: 10px !important;
          min-height: 36px;
          padding: 0 14px !important;
        }

        .Polaris-Modal-Footer .Polaris-ButtonGroup__Item:last-child .Polaris-Button:hover,
        .Polaris-Modal-Footer .Polaris-Button--variantPrimary:hover {
          filter: brightness(0.97);
          transform: translateY(-1px);
        }

        .Polaris-Modal-Footer .Polaris-Button--variantSecondary,
        .Polaris-Modal-Footer .Polaris-ButtonGroup__Item:first-child .Polaris-Button {
          border-radius: 10px !important;
          border: 1px solid #c9d8ef !important;
          background: #ffffff !important;
          color: #334155 !important;
          min-height: 36px;
          padding: 0 14px !important;
        }

        .config-modal-shell {
          border: 1px solid #d6e4f7;
          border-radius: 12px;
          padding: 12px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        }

        .config-modal-meta {
          margin-bottom: 8px;
          border-bottom: 1px solid #e5edf9;
          padding-bottom: 8px;
        }

        .product-name-highlight {
          color: #0f5132 !important;
          font-weight: 700;
          font-size: 21px;
          line-height: 1.2;
          margin-bottom: 8px !important;
          margin-top: 0;
        }

        .product-id-highlight,
        .product-sku-highlight {
          color: #166534 !important;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 2px !important;
          margin-top: 0;
        }

        .product-id-highlight span,
        .product-sku-highlight span {
          color: #1f2937;
          font-weight: 700;
          background: #e8f7ec;
          border: 1px solid #b7e3c2;
          border-radius: 6px;
          padding: 1px 8px;
          margin-left: 4px;
          display: inline-block;
        }

        .config-toggle-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          border: 1px solid #dce8f8;
          border-radius: 10px;
          padding: 8px 10px;
          background: #ffffff;
        }

        .config-toggle-row .Polaris-Text--root {
          margin: 0;
        }

        .config-toggle-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .config-toggle-row .config-toggle-wrap {
          margin-left: 6px;
        }

        .config-toggle-input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .config-toggle-slider {
          width: 42px;
          height: 22px;
          border-radius: 999px;
          background: #cbd5e1;
          border: 1px solid #b7c4d8;
          position: relative;
          transition: all 160ms ease;
        }

        .config-toggle-slider::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          transition: all 160ms ease;
        }

        .config-toggle-input:checked + .config-toggle-slider {
          background: linear-gradient(120deg, #2563eb 0%, #0f766e 100%);
          border-color: transparent;
        }

        .config-toggle-input:checked + .config-toggle-slider::after {
          transform: translateX(20px);
        }

        .config-modal-shell .Polaris-FormLayout {
          gap: 10px;
        }

        .config-modal-shell .Polaris-FormLayout__Items {
          row-gap: 10px;
        }

        .events-switch-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }

        .events-switch-input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .events-switch-slider {
          width: 40px;
          height: 22px;
          border-radius: 999px;
          background: #d1d9e8;
          border: 1px solid #b9c6df;
          position: relative;
          transition: all 160ms ease;
        }

        .events-switch-slider::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
          transition: all 160ms ease;
        }

        .events-switch-input:checked + .events-switch-slider {
          background: linear-gradient(120deg, #16a34a 0%, #0f766e 100%);
          border-color: transparent;
        }

        .events-switch-input:checked + .events-switch-slider::after {
          transform: translateX(18px);
        }

        .event-modal-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid #dce8f8;
          border-radius: 10px;
          padding: 8px 10px;
          background: #fff;
        }
      `}</style>
    </Page>
  );
}

export default LoyaltyDashboard;
