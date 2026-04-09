export const EMAIL_TEMPLATE_KEYS = {
  GIFT_CARD: "giftcard_generation",
  REFER_FRIEND: "refer_friend",
};

export const EMAIL_TEMPLATE_DEFAULTS = {
  [EMAIL_TEMPLATE_KEYS.GIFT_CARD]: {
    templateKey: EMAIL_TEMPLATE_KEYS.GIFT_CARD,
    templateName: "Generate Giftcard",
    subject: "Your Loyalty Gift Card Coupon Code",
    textBody: [
      "Hello,",
      "",
      "You've received a Loyalty Gift Card!",
      "",
      "Coupon Code: {{giftCode}}",
      "Amount: {{giftAmount}}",
      "{{expiryTextLine}}",
      "",
      "Use it at checkout to redeem your discount.",
      "",
      "Thank you!",
    ]
      .filter(Boolean)
      .join("\n"),
    htmlBody: `
      <div style="font-family: Arial, sans-serif; font-size: 16px; color: #1f2937;">
        <p>Hello,</p>
        <p>You've received a Loyalty Gift Card!</p>
        <p><strong>Coupon Code:</strong> {{giftCode}}</p>
        <p><strong>Amount:</strong> {{giftAmount}}</p>
        {{expiryHtmlLine}}
        <p>Use it at checkout to redeem your discount.</p>
        <p>Thank you!</p>
      </div>
    `.trim(),
    placeholders: ["giftCode", "giftAmount", "expiryDate", "expiryTextLine", "expiryHtmlLine"],
  },
  [EMAIL_TEMPLATE_KEYS.REFER_FRIEND]: {
    templateKey: EMAIL_TEMPLATE_KEYS.REFER_FRIEND,
    templateName: "Refer Friend",
    subject: "Your referral code from NetScore Loyalty Rewards",
    textBody: [
      "Hello,",
      "",
      "{{customerName}} has shared a referral code with you.",
      "",
      "Referral Code: {{referralCode}}",
      "",
      "Use this code during signup to enjoy loyalty rewards.",
      "",
      "Thank you!",
    ].join("\n"),
    htmlBody: `
      <div style="font-family: Arial, sans-serif; font-size: 16px; color: #1f2937;">
        <p>Hello,</p>
        <p><strong>{{customerName}}</strong> has shared a referral code with you.</p>
        <p><strong>Referral Code:</strong> {{referralCode}}</p>
        <p>Use this code during signup to enjoy loyalty rewards.</p>
        <p>Thank you!</p>
      </div>
    `.trim(),
    placeholders: ["customerName", "referralCode"],
  },
};
