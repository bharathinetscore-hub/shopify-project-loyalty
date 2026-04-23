export const EMAIL_TEMPLATE_KEYS = {
  GIFT_CARD: "giftcard_generation",
  REFER_FRIEND: "refer_friend",
  POINTS_EARNED: "points_earned",
  POINTS_REDEEMED: "points_redeemed",
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
    placeholders: ["giftCode", "giftAmount", "expiryDate", "expiryTextLine"],
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
    placeholders: ["customerName", "referralCode"],
  },
  [EMAIL_TEMPLATE_KEYS.POINTS_EARNED]: {
    templateKey: EMAIL_TEMPLATE_KEYS.POINTS_EARNED,
    templateName: "Points Earned",
    subject: "You earned loyalty points",
    textBody: [
      "Hello {{customerName}},",
      "",
      "You have earned {{points}} loyalty points.",
      "Activity: {{eventName}}",
      "Available Points: {{availablePoints}}",
      "{{amountLine}}",
      "{{commentsLine}}",
      "",
      "Thank you!",
    ]
      .filter(Boolean)
      .join("\n"),
    placeholders: ["customerName", "points", "eventName", "availablePoints", "amountLine", "commentsLine"],
  },
  [EMAIL_TEMPLATE_KEYS.POINTS_REDEEMED]: {
    templateKey: EMAIL_TEMPLATE_KEYS.POINTS_REDEEMED,
    templateName: "Points Redeemed",
    subject: "You redeemed loyalty points",
    textBody: [
      "Hello {{customerName}},",
      "",
      "You have redeemed {{points}} loyalty points.",
      "Activity: {{eventName}}",
      "Available Points: {{availablePoints}}",
      "{{amountLine}}",
      "{{commentsLine}}",
      "",
      "Thank you!",
    ]
      .filter(Boolean)
      .join("\n"),
    placeholders: ["customerName", "points", "eventName", "availablePoints", "amountLine", "commentsLine"],
  },
};
