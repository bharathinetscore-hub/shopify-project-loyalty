import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<CustomerProfileLoyaltySection />, document.body);
};

function CustomerProfileLoyaltySection() {
  return (
    <s-admin-block heading="Loyalty Rewards">
      <s-stack direction="block" gap="small">
        <s-heading size="small">Loyalty Rewards</s-heading>
        <s-text>
          This section will show customer loyalty details here soon.
        </s-text>
      </s-stack>
    </s-admin-block>
  );
}
