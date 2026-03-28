# Extensions Guide – Errors & Profile Custom Content

## Your extensions (no build errors)

All three extensions **build successfully**. Here’s what each does and what can go wrong at runtime.

| Extension | Target | Where it runs | Main runtime issues |
|-----------|--------|----------------|---------------------|
| **Loyalty Rewards Profile** (`netscore-loyalty-customer-account`) | `customer-account.profile.block.render` | Customer Account **Profile** page | Block not placed; wrong API URL in dev |
| **NetScore Loyalty Rewards** (`net-score-loyalty-rewards`) | `admin.product-details.block.render` | Admin **Product** detail page | “Failed to fetch” if API URL ≠ app tunnel |
| **Checkout Loyalty Message** (`netscore-loyalty-checkout-message`) | `purchase.checkout.block.render` | Checkout | Same API URL / CORS issues in dev |

---

## Why you see errors

1. **“Failed to fetch”**  
   The extension calls your app API. If the app runs on a **different URL** than the one the extension uses (e.g. a stale `HOST` in `.env` while `shopify app dev` opened a new Cloudflare tunnel), the browser blocks or fails the request.  
   **Fix:** Run **`shopify app dev`** so the CLI injects the current tunnel URL (`HOST` / `APP_URL`), and use the **preview link from the CLI**. Don’t keep old tunnel URLs in `.env`. Checkout extension uses `window.location.origin` for `*.trycloudflare.com` in dev.

2. **Profile shows default content only (no loyalty block)**  
   The loyalty block is a **block** on the Profile. It does **not** replace the whole page. If the block is not **added** in the Customer Account layout, you only see the default profile.  
   **Fix:** Add the block (see below).

3. **Script tag / webhook warnings in terminal**  
   These come from `ensure-storefront-loader` (script tag needs `read_script_tags` / `write_script_tags`; orders webhook needs orders scope). The API still returns 200; the dashboard works. Add the right scopes and re-authorize if you need those features.

---

## How to show your custom content on the Profile

The **Loyalty Rewards Profile** extension only appears when its block is **placed** on the Customer Account Profile.

### Steps

1. In **Shopify Admin** go to **Settings**.
2. Open **Checkout and accounts** (or **Customer accounts**, depending on your admin).
3. Find the option to **customize the customer account** experience (e.g. “Customize” for Customer account or “Theme” for checkout/accounts).
4. In the editor, open the **Profile** page (or the template that shows the customer profile).
5. Add a block: look for an **App block** or **Apps** section and add **“Loyalty Rewards Profile”** (or the name of the `netscore-loyalty-customer-account` extension).
6. **Save** and exit the editor.

Until this block is added, the Profile page will show only the default Shopify profile; your loyalty content will not appear.

### Dev preview

- Use the **preview link** from `shopify app dev` so the extension and app use the same tunnel.
- You can add `?placement-reference=PROFILE1` (or the placement your store uses) to the Profile URL to control where the block appears in the layout.

---

## Unused files (safe to ignore or remove)

In **net-score-loyalty-rewards** the toml only references `BlockExtension.jsx` (product block). These are **not** used by any target:

- `CustomerAccountProfileExtension.jsx`
- `CustomerProfileBlockExtension.jsx`

The **profile** custom content comes only from the **netscore-loyalty-customer-account** extension (`index.jsx`), not from these files.
