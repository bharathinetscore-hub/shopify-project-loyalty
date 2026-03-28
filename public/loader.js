// Client-only storefront helper script; does nothing during SSR/Next build.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  (function () {
    console.log("✅ Loyalty Script Loaded");

    document.addEventListener("DOMContentLoaded", () => {
      const form = document.querySelector("form[action*='/cart/add']");
      if (!form) return;

      const div = document.createElement("div");
      div.innerHTML = `
        <div style="border:1px solid #ccc;padding:10px;margin:10px 0;">
          <h3>Loyalty Rewards</h3>

          <label>
            <input type="checkbox" name="loyalty_1" />
            Enable Reward Points
          </label><br/>

          <label>
            <input type="checkbox" name="loyalty_2" />
            Special Loyalty Offer
          </label>
        </div>
      `;

      form.prepend(div);
    });
  })();
}
