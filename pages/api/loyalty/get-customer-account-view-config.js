import pool from "../../../db/db";
import cors from "../../../lib/cors";

const DEFAULT_LABELS = {
  myAccountTabHeading: "Loyalty Rewards Information",
  loyaltyPointsEarnedLabel: "Loyalty Points Earned",
  redeemHistoryLabel: "Redeem Points History",
  referFriendLabel: "Refer Your Friend",
  giftCardLabel: "Generate Gift Card",
  tiersLabel: "Loyalty Tiers",
  updateProfileLabel: "Update Profile",
};

function cleanText(value) {
  return String(value || "").trim();
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function withFallback(value, fallback) {
  const normalized = cleanText(value);
  return normalized || fallback;
}

async function ensureFeaturesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_features_table (
      id SERIAL PRIMARY KEY,
      loyalty_eligible BOOLEAN DEFAULT FALSE,
      product_sharing_through_email BOOLEAN DEFAULT FALSE,
      enable_referral_code_use_at_signup BOOLEAN DEFAULT FALSE,
      login_to_see_points BOOLEAN DEFAULT FALSE,
      enable_redeem_history BOOLEAN DEFAULT FALSE,
      enable_refer_friend BOOLEAN DEFAULT FALSE,
      enable_gift_certificate_generation BOOLEAN DEFAULT FALSE,
      enable_tiers_info BOOLEAN DEFAULT FALSE,
      enable_profile_info BOOLEAN DEFAULT FALSE,
      enable_points_redeem_on_checkout BOOLEAN DEFAULT FALSE,
      my_account_tab_heading TEXT,
      loyalty_points_earned_label TEXT,
      redeem_history_label TEXT,
      refer_friend_label TEXT,
      gift_card_label TEXT,
      tiers_label TEXT,
      update_profile_label TEXT,
      product_redeem_label TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE netst_features_table
    ADD COLUMN IF NOT EXISTS loyalty_points_earned_label TEXT
  `);
}

async function ensureCustomersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customers_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NULL,
      customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const ensureColumn = async (columnName, definitionSql) => {
    const check = await pool.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'netst_customers_table'
        AND column_name = $1
      LIMIT 1
      `,
      [columnName]
    );

    if (!check.rows.length) {
      await pool.query(`ALTER TABLE netst_customers_table ADD COLUMN ${definitionSql};`);
    }
  };

  await ensureColumn("customer_birthday", "customer_birthday DATE NULL");
  await ensureColumn("customer_anniversary", "customer_anniversary DATE NULL");
  await ensureColumn("customer_referral_code", "customer_referral_code TEXT NULL");
  await ensureColumn("customer_used_referral_code", "customer_used_referral_code TEXT NULL");
}

function buildReferralCodeSeed(customerId, customerName) {
  const nameSeed = cleanText(customerName)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  const idSeed = parseCustomerId(customerId).slice(-4) || `${Date.now()}`.slice(-4);
  const randomSeed = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `NSL-${nameSeed || "USER"}-${idSeed}${randomSeed}`;
}

async function generateUniqueReferralCode(customerId, customerName) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = buildReferralCodeSeed(customerId, customerName);
    const existing = await pool.query(
      `
      SELECT 1
      FROM netst_customers_table
      WHERE customer_referral_code = $1
      LIMIT 1
      `,
      [candidate]
    );

    if (!existing.rows.length) {
      return candidate;
    }
  }

  return `NSL-${parseCustomerId(customerId).slice(-6) || Date.now().toString().slice(-6)}-${Date.now()
    .toString()
    .slice(-4)}`;
}

async function ensureCustomerReferralCode({ customerIdRaw, customerIdParsed, customerEmail, customerName }) {
  const lookupRes = await pool.query(
    `
      SELECT customer_id, customer_email, customer_referral_code
      FROM netst_customers_table
      WHERE (
        ($1::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($1))
        OR ($2::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($2))
        OR ($2::text <> '' AND regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $2)
        OR ($3::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($3)))
      )
      ORDER BY
        CASE
          WHEN ($2::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($2)) THEN 1
          WHEN ($2::text <> '' AND regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $2) THEN 2
          WHEN ($1::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($1)) THEN 3
          WHEN ($3::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($3))) THEN 4
          ELSE 5
        END,
        updated_at DESC NULLS LAST,
        id DESC
      LIMIT 1
    `,
    [customerIdRaw || "", customerIdParsed || "", customerEmail || ""]
  );

  const existing = lookupRes.rows[0] || null;
  const resolvedCustomerId = cleanText(existing?.customer_id);

  // Do not auto-create customer rows from customer-account/profile access.
  // Loyalty customers must be inserted explicitly from the admin "Select Shopify Customer" flow.
  if (!existing || !resolvedCustomerId) {
    return;
  }

  const existingCode = cleanText(existing?.customer_referral_code);
  if (existingCode) {
    return;
  }

  const referralCode = await generateUniqueReferralCode(resolvedCustomerId, customerName);
  const resolvedCustomerEmail = cleanText(existing?.customer_email) || cleanText(customerEmail) || null;
  const resolvedCustomerName = cleanText(customerName);

  await pool.query(
    `
      UPDATE netst_customers_table
      SET
        customer_name = COALESCE(NULLIF($2, ''), customer_name),
        customer_email = COALESCE(NULLIF($3, ''), customer_email),
        customer_referral_code = COALESCE(NULLIF(customer_referral_code, ''), $4),
        updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $1
    `,
    [
      resolvedCustomerId,
      resolvedCustomerName,
      resolvedCustomerEmail,
      referralCode,
    ]
  );
}

async function loadCustomerEligibility(customerIdRaw, customerIdParsed, customerEmail) {
  if (customerIdRaw || customerIdParsed) {
    const byId = await pool.query(
      `
      SELECT
        customer_eligible_for_loyalty,
        customer_id,
        customer_email,
        customer_birthday,
        customer_anniversary,
        customer_referral_code,
        customer_used_referral_code
      FROM netst_customers_table
      WHERE (
        TRIM(COALESCE(customer_id, '')) = TRIM($1)
        OR TRIM(COALESCE(customer_id, '')) = TRIM($2)
        OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $2
      )
      ORDER BY
        CASE
          WHEN ($2::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($2)) THEN 1
          WHEN ($2::text <> '' AND regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $2) THEN 2
          WHEN ($1::text <> '' AND TRIM(COALESCE(customer_id, '')) = TRIM($1)) THEN 3
          ELSE 4
        END,
        updated_at DESC NULLS LAST,
        id DESC
      LIMIT 1
      `,
      [customerIdRaw || "", customerIdParsed || ""]
    );
    if (byId.rows.length) {
      return {
        eligible: Boolean(byId.rows[0]?.customer_eligible_for_loyalty),
        matchedBy: "customer_id",
        matchedCustomerId: String(byId.rows[0]?.customer_id || ""),
        matchedCustomerEmail: String(byId.rows[0]?.customer_email || ""),
        birthday: byId.rows[0]?.customer_birthday || null,
        anniversary: byId.rows[0]?.customer_anniversary || null,
        referralCode: String(byId.rows[0]?.customer_referral_code || ""),
        usedReferralCode: String(byId.rows[0]?.customer_used_referral_code || ""),
      };
    }
  }

  if (customerEmail) {
    const byEmail = await pool.query(
      `
      SELECT
        customer_eligible_for_loyalty,
        customer_id,
        customer_email,
        customer_birthday,
        customer_anniversary,
        customer_referral_code,
        customer_used_referral_code
      FROM netst_customers_table
      WHERE LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($1))
      ORDER BY
        CASE
          WHEN regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') <> '' THEN 1
          ELSE 2
        END,
        updated_at DESC NULLS LAST,
        id DESC
      LIMIT 1
      `,
      [customerEmail]
    );
    if (byEmail.rows.length) {
      return {
        eligible: Boolean(byEmail.rows[0]?.customer_eligible_for_loyalty),
        matchedBy: "customer_email",
        matchedCustomerId: String(byEmail.rows[0]?.customer_id || ""),
        matchedCustomerEmail: String(byEmail.rows[0]?.customer_email || ""),
        birthday: byEmail.rows[0]?.customer_birthday || null,
        anniversary: byEmail.rows[0]?.customer_anniversary || null,
        referralCode: String(byEmail.rows[0]?.customer_referral_code || ""),
        usedReferralCode: String(byEmail.rows[0]?.customer_used_referral_code || ""),
      };
    }
  }

  return {
    eligible: false,
    matchedBy: "",
    matchedCustomerId: "",
    matchedCustomerEmail: "",
    birthday: null,
    anniversary: null,
    referralCode: "",
    usedReferralCode: "",
  };
}

async function ensureEventDetailsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_customer__event_details_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL,
      date_created DATE DEFAULT NULL,
      event_name VARCHAR(255) DEFAULT NULL,
      points_earned NUMERIC(10,2) DEFAULT 0.00,
      points_redeemed NUMERIC(10,2) DEFAULT 0.00,
      points_left NUMERIC(10,2) DEFAULT 0.00,
      transaction_id BIGINT DEFAULT NULL,
      amount NUMERIC(10,2) DEFAULT 0.00,
      gift_code VARCHAR(100) DEFAULT NULL,
      receiver_email VARCHAR(255) DEFAULT NULL,
      refer_friend_id BIGINT DEFAULT NULL,
      comments TEXT DEFAULT NULL,
      points_expiration_date DATE DEFAULT NULL,
      points_expiration_days VARCHAR(255) DEFAULT NULL,
      expired BOOLEAN DEFAULT FALSE,
      points_type VARCHAR(10) DEFAULT 'positive',
      created_at TIMESTAMP DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT NULL,
      event_id INTEGER DEFAULT NULL
    )
  `);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function ensureTiersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_tiers_table (
      id SERIAL PRIMARY KEY,
      tier_name VARCHAR(100),
      threshold DECIMAL(10,2),
      points_per_dollar DECIMAL(10,2),
      ns_id VARCHAR(100),
      description TEXT,
      level INTEGER,
      status BOOLEAN,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);
}

async function loadLoyaltyTiers() {
  await ensureTiersTable();

  const tiersRes = await pool.query(
    `
      SELECT
        id,
        tier_name,
        threshold,
        points_per_dollar,
        description,
        level,
        status
      FROM netst_loyalty_tiers_table
      WHERE COALESCE(status, false) = true
      ORDER BY COALESCE(threshold, 0) ASC, COALESCE(level, 0) ASC, id ASC
    `
  );

  return tiersRes.rows.map((row) => ({
    id: Number(row?.id || 0),
    name: cleanText(row?.tier_name) || "Tier",
    threshold: toNumber(row?.threshold, 0),
    pointsPerDollar: toNumber(row?.points_per_dollar, 0),
    description: cleanText(row?.description),
    level: toNumber(row?.level, 0),
    active: Boolean(row?.status),
  }));
}

function calculateTierSummary(availablePoints, tiers) {
  const safePoints = Math.max(0, toNumber(availablePoints, 0));
  const sortedTiers = Array.isArray(tiers) ? tiers : [];

  if (!sortedTiers.length) {
    return {
      currentTier: null,
      nextTier: null,
      progressPercent: 0,
      pointsToNextTier: 0,
      progressCurrentThreshold: 0,
      progressNextThreshold: 0,
      isHighestTier: false,
    };
  }

  let currentTier = null;
  for (const tier of sortedTiers) {
    if (safePoints >= toNumber(tier.threshold, 0)) {
      currentTier = tier;
    } else {
      break;
    }
  }

  const currentTierIndex = currentTier
    ? sortedTiers.findIndex((tier) => tier.id === currentTier.id)
    : -1;

  const nextTier =
    currentTierIndex >= 0
      ? sortedTiers[currentTierIndex + 1] || null
      : sortedTiers[0] || null;

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      progressPercent: 100,
      pointsToNextTier: 0,
      progressCurrentThreshold: currentTier ? toNumber(currentTier.threshold, 0) : 0,
      progressNextThreshold: currentTier ? toNumber(currentTier.threshold, 0) : 0,
      isHighestTier: true,
    };
  }

  const progressCurrentThreshold = currentTier ? toNumber(currentTier.threshold, 0) : 0;
  const progressNextThreshold = toNumber(nextTier.threshold, 0);
  const progressRange = Math.max(progressNextThreshold - progressCurrentThreshold, 0);
  const normalizedPoints = Math.min(
    Math.max(safePoints, progressCurrentThreshold),
    progressNextThreshold
  );
  const progressPercent =
    progressRange <= 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((normalizedPoints - progressCurrentThreshold) / progressRange) * 100
          )
        );

  return {
    currentTier,
    nextTier,
    progressPercent,
    pointsToNextTier: Math.max(progressNextThreshold - safePoints, 0),
    progressCurrentThreshold,
    progressNextThreshold,
    isHighestTier: false,
  };
}

async function loadCustomerEventDetails(customerLookup, customerEmail) {
  const matchedId = parseCustomerId(customerLookup?.matchedCustomerId || "");
  const inputEmail = cleanText(customerEmail);
  const matchedEmail = cleanText(customerLookup?.matchedCustomerEmail || "");
  const email = matchedEmail || inputEmail;

  if (!matchedId && !email) {
    return {
      rows: [],
      totals: { totalEarnedPoints: 0, totalRedeemedPoints: 0, availablePoints: 0 },
    };
  }

  const eventRowsRes = await pool.query(
    `
      SELECT
        date_created,
        event_name,
        transaction_id,
        points_earned,
        points_redeemed,
        points_type,
        amount,
        gift_code,
        created_at
      FROM netst_customer__event_details_table
      WHERE (
        ($1::text <> '' AND customer_id::text = $1)
        OR ($2::text <> '' AND LOWER(TRIM(COALESCE(receiver_email, ''))) = LOWER(TRIM($2)))
      )
      ORDER BY COALESCE(created_at, NOW()) DESC, id DESC
      LIMIT 50
    `,
    [matchedId || "", email || ""]
  );

  const rows = eventRowsRes.rows.map((row) => ({
    date: row?.date_created || null,
    activityPerformed: cleanText(row?.event_name) || "-",
    referenceId: row?.transaction_id
      ? String(row.transaction_id)
      : cleanText(row?.gift_code) || "-",
    pointsEarned: toNumber(row?.points_earned, 0),
    pointsRedeemed: toNumber(row?.points_redeemed, 0),
    amount: toNumber(row?.amount, 0),
    pointsType: cleanText(row?.points_type).toLowerCase() || "positive",
  }));

  const totals = rows.reduce(
    (acc, row) => {
      if (row.pointsType === "negative") {
        acc.totalRedeemedPoints += row.pointsRedeemed > 0 ? row.pointsRedeemed : Math.abs(row.pointsEarned);
      } else {
        acc.totalEarnedPoints += row.pointsEarned;
        acc.totalRedeemedPoints += row.pointsRedeemed;
      }
      return acc;
    },
    { totalEarnedPoints: 0, totalRedeemedPoints: 0, availablePoints: 0 }
  );
  totals.availablePoints = totals.totalEarnedPoints - totals.totalRedeemedPoints;

  return { rows, totals };
}

async function loadGiftCardConfig() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
      id SERIAL PRIMARY KEY,
      each_point_value NUMERIC(10,2) DEFAULT 1.00,
      loyalty_point_value NUMERIC(10,2) DEFAULT 1.00,
      minimum_redemption_points NUMERIC(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const configRes = await pool.query(
    `
      SELECT
        minimum_redemption_points,
        each_point_value,
        loyalty_point_value,
        giftcard_expiry_days
      FROM netst_loyalty_config_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const config = configRes.rows[0] || {};
  return {
    minimumRedemptionPoints: toNumber(config?.minimum_redemption_points, 0),
    eachPointValue: toNumber(config?.each_point_value, 1),
    loyaltyPointValue: toNumber(config?.loyalty_point_value, 1),
    giftcardExpiryDays: toNumber(config?.giftcard_expiry_days, 0),
  };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await ensureFeaturesTable();
    await ensureCustomersTable();
    await ensureEventDetailsTable();
    await ensureTiersTable();

    const customerIdRaw = cleanText(req.body?.customerIdRaw || req.body?.customerId);
    const customerIdParsed = parseCustomerId(customerIdRaw);
    const customerEmail = cleanText(req.body?.customerEmail);
    const customerName = cleanText(req.body?.customerName);

    const featuresRes = await pool.query(
      `
      SELECT
        loyalty_eligible,
        enable_referral_code_use_at_signup,
        enable_refer_friend,
        enable_gift_certificate_generation,
        enable_tiers_info,
        enable_profile_info,
        enable_points_redeem_on_checkout,
        my_account_tab_heading,
        loyalty_points_earned_label,
        redeem_history_label,
        refer_friend_label,
        gift_card_label,
        tiers_label,
        update_profile_label
      FROM netst_features_table
      ORDER BY id DESC
      LIMIT 1
      `
    );

    const features = featuresRes.rows[0] || null;
    const globalLoyaltyEnabled = Boolean(features?.loyalty_eligible);
    const referralCodeAtSignupEnabled = Boolean(
      features?.enable_referral_code_use_at_signup
    );
    const referFriendEnabled = Boolean(features?.enable_refer_friend);
    const giftCertificateGenerationEnabled = Boolean(
      features?.enable_gift_certificate_generation
    );
    const tiersInfoEnabled = Boolean(features?.enable_tiers_info);
    const profileInfoEnabled = Boolean(features?.enable_profile_info);
    const pointsRedeemOnCheckoutEnabled = Boolean(features?.enable_points_redeem_on_checkout);
    await ensureCustomerReferralCode({
      customerIdRaw,
      customerIdParsed,
      customerEmail,
      customerName,
    });
    const customerLookup = await loadCustomerEligibility(
      customerIdRaw,
      customerIdParsed,
      customerEmail
    );
    const customerEventDetails = await loadCustomerEventDetails(customerLookup, customerEmail);
    const loyaltyTiers = await loadLoyaltyTiers();
    const tierSummary = calculateTierSummary(
      customerEventDetails?.totals?.availablePoints,
      loyaltyTiers
    );
    const giftCardConfig = await loadGiftCardConfig();
    const customerEligible = Boolean(customerLookup?.eligible);
    const visible = globalLoyaltyEnabled && customerEligible;

    return res.status(200).json({
      visible,
      labels: {
        myAccountTabHeading: withFallback(
          features?.my_account_tab_heading,
          DEFAULT_LABELS.myAccountTabHeading
        ),
        loyaltyPointsEarnedLabel: withFallback(
          features?.loyalty_points_earned_label,
          DEFAULT_LABELS.loyaltyPointsEarnedLabel
        ),
        redeemHistoryLabel: withFallback(
          features?.redeem_history_label,
          DEFAULT_LABELS.redeemHistoryLabel
        ),
        referFriendLabel: withFallback(
          features?.refer_friend_label,
          DEFAULT_LABELS.referFriendLabel
        ),
        giftCardLabel: withFallback(
          features?.gift_card_label,
          DEFAULT_LABELS.giftCardLabel
        ),
        tiersLabel: withFallback(features?.tiers_label, DEFAULT_LABELS.tiersLabel),
        updateProfileLabel: withFallback(
          features?.update_profile_label,
          DEFAULT_LABELS.updateProfileLabel
        ),
      },
      globalLoyaltyEnabled,
      customerEligible,
      referralCodeAtSignupEnabled,
      referFriendEnabled,
      giftCertificateGenerationEnabled,
      tiersInfoEnabled,
      profileInfoEnabled,
      pointsRedeemOnCheckoutEnabled,
      customerLookup: {
        inputCustomerIdRaw: customerIdRaw,
        inputCustomerIdParsed: customerIdParsed,
        inputCustomerEmail: customerEmail,
        matchedBy: customerLookup?.matchedBy || "",
        matchedCustomerId: customerLookup?.matchedCustomerId || "",
        matchedCustomerEmail: customerLookup?.matchedCustomerEmail || "",
      },
      profile: {
        birthday: customerLookup?.birthday || null,
        anniversary: customerLookup?.anniversary || null,
        referralCode: customerLookup?.referralCode || "",
        usedReferralCode: customerLookup?.usedReferralCode || "",
      },
      loyaltyPointsEarned: {
        totalEarnedPoints: Number(customerEventDetails.totals.totalEarnedPoints || 0),
        totalRedeemedPoints: Number(customerEventDetails.totals.totalRedeemedPoints || 0),
        availablePoints: Number(customerEventDetails.totals.availablePoints || 0),
        rows: customerEventDetails.rows
          .filter((row) => row.pointsType === "positive")
          .map((row) => ({
            date: row.date,
            activityPerformed: row.activityPerformed,
            referenceId: row.referenceId,
            pointsEarned: Number(row.pointsEarned || 0),
          })),
      },
      redeemHistory: {
        rows: customerEventDetails.rows
          .filter((row) => row.pointsType === "negative")
          .map((row) => ({
            date: row.date,
            activityPerformed: row.activityPerformed,
            referenceId: row.referenceId,
            pointsRedeemed: Number(
              row.pointsRedeemed > 0 ? row.pointsRedeemed : Math.abs(Number(row.pointsEarned || 0))
            ),
            amount: Number(row.amount || 0),
          })),
      },
      loyaltyTiers: {
        rows: loyaltyTiers,
        summary: tierSummary,
      },
      giftCardConfig,
    });
  } catch (error) {
    console.error("get-customer-account-view-config error:", error);
    return res.status(500).json({ message: "Failed to load customer account view config" });
  }
}
