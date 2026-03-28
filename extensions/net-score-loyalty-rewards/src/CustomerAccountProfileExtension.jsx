import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<CustomerAccountLoyaltySection />, document.body);
};

function CustomerAccountLoyaltySection() {
  return (
    <s-stack direction="block" gap="small">
      <s-heading size="small">Loyalty Rewards</s-heading>
      <s-text>
        Welcome to your loyalty area. Points and rewards details will appear here soon.
      </s-text>
    </s-stack>
  );
}
