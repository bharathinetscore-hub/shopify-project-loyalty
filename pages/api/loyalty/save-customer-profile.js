import pool from "../../../db/db";
import cors from "../../../lib/cors";
import { sendPointsEarnedEmail } from "../../../lib/points-email";

function cleanText(value) {
  return String(value || "").trim();
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function normalizeDate(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function toNumber(input, fallback = 0) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWholeNumber(input, fallback = 0) {
  return Math.max(0, Math.floor(toNumber(input, fallback)));
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function buildPointsExpirationDate(days) {
  const safeDays = normalizeWholeNumber(days, 0);
  if (!safeDays) return null;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + safeDays);
  return formatDateOnly(nextDate);
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

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value));
}

function normalizeCustomerName(name, email, customerId) {
  const safeName = cleanText(name);
  const safeEmail = cleanText(email);

  if (safeName && !looksLikeEmail(safeName) && safeName.toLowerCase() !== safeEmail.toLowerCase()) {
    return safeName;
  }

  return "";
}

async function generateUniqueReferralCode(db, customerId, customerName) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = buildReferralCodeSeed(customerId, customerName);
    const existing = await db.query(
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

async function ensureCustomersTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_customers_table (
      id BIGSERIAL PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ensureColumn = async (columnName, definitionSql) => {
    const check = await db.query(
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
      await db.query(`ALTER TABLE netst_customers_table ADD COLUMN ${definitionSql};`);
    }
  };

  await ensureColumn("customer_birthday", "customer_birthday DATE NULL");
  await ensureColumn("customer_anniversary", "customer_anniversary DATE NULL");
  await ensureColumn(
    "customer_eligible_for_loyalty",
    "customer_eligible_for_loyalty BOOLEAN NOT NULL DEFAULT false"
  );
  await ensureColumn("customer_referral_code", "customer_referral_code TEXT NULL");
  await ensureColumn("customer_used_referral_code", "customer_used_referral_code TEXT NULL");
  await ensureColumn("total_earned_points", "total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn(
    "total_redeemed_points",
    "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0"
  );
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
}

async function ensureEventDetailsTable(db) {
  await db.query(`
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

async function ensureEventsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    ALTER TABLE netst_events_table
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
  `);
}

async function ensureConfigTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
      id SERIAL PRIMARY KEY,
      customer_signup_points NUMERIC(10,2) DEFAULT 0.00,
      referral_points NUMERIC(10,2) DEFAULT 0.00,
      birthday_points NUMERIC(10,2) DEFAULT 0.00,
      anniversary_points NUMERIC(10,2) DEFAULT 0.00,
      points_expiration_days VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS customer_signup_points NUMERIC(10,2) DEFAULT 0.00
  `);
  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS referral_points NUMERIC(10,2) DEFAULT 0.00
  `);
  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS birthday_points NUMERIC(10,2) DEFAULT 0.00
  `);
  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS anniversary_points NUMERIC(10,2) DEFAULT 0.00
  `);
  await db.query(`
    ALTER TABLE netst_loyalty_config_table
    ADD COLUMN IF NOT EXISTS points_expiration_days VARCHAR(255) DEFAULT NULL
  `);
}

async function ensureFeaturesTable(db) {
  await db.query(`
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
}

async function loadProfileFeatureFlags(db) {
  await ensureFeaturesTable(db);

  const result = await db.query(
    `
      SELECT loyalty_eligible, enable_profile_info, enable_referral_code_use_at_signup
      FROM netst_features_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = result.rows[0] || {};
  return {
    globalLoyaltyEnabled: Boolean(row.loyalty_eligible),
    profileInfoEnabled: Boolean(row.enable_profile_info),
    referralCodeAtSignupEnabled: Boolean(row.enable_referral_code_use_at_signup),
  };
}

async function loadProfileAwardConfig(db) {
  const result = await db.query(
    `
      SELECT customer_signup_points, referral_points, birthday_points, anniversary_points, points_expiration_days
      FROM netst_loyalty_config_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = result.rows[0] || {};
  return {
    customerSignupPoints: toNumber(row.customer_signup_points, 0),
    referralPoints: toNumber(row.referral_points, 0),
    birthdayPoints: toNumber(row.birthday_points, 0),
    anniversaryPoints: toNumber(row.anniversary_points, 0),
    pointsExpirationDays: normalizeWholeNumber(row.points_expiration_days, 0),
  };
}

async function loadEventDefinition(db, eventId) {
  const result = await db.query(
    `
      SELECT event_id, event_name, is_active
      FROM netst_events_table
      WHERE event_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
    [String(eventId)]
  );

  const row = result.rows[0] || null;
  if (!row) return null;

  return {
    id: toNumber(row.event_id, eventId),
    name: cleanText(row.event_name),
    isActive: row.is_active !== false,
  };
}

async function ensureEventDefinition(db, eventId, fallbackName) {
  const existing = await loadEventDefinition(db, eventId);
  if (existing?.name) {
    return existing;
  }

  await db.query(
    `
      INSERT INTO netst_events_table (event_id, event_name, is_active, created_at, updated_at)
      VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id)
      DO UPDATE SET
        event_name = COALESCE(NULLIF(netst_events_table.event_name, ''), EXCLUDED.event_name),
        updated_at = CURRENT_TIMESTAMP
    `,
    [String(eventId), fallbackName]
  );

  return {
    id: toNumber(eventId, 0),
    name: fallbackName,
    isActive: true,
  };
}

async function loadExistingAwards(db, customerId, eventIds) {
  const result = await db.query(
    `
      SELECT event_id
      FROM netst_customer__event_details_table
      WHERE customer_id = $1
        AND points_type = 'positive'
        AND event_id = ANY($2::int[])
    `,
    [toNumber(customerId, 0), eventIds]
  );

  return new Set(result.rows.map((row) => toNumber(row.event_id, 0)));
}

async function loadCustomerByReferralCode(db, referralCode) {
  const normalizedCode = cleanText(referralCode);
  if (!normalizedCode) return null;

  const result = await db.query(
    `
      SELECT
        customer_id,
        customer_name,
        customer_email,
        customer_referral_code,
        total_earned_points,
        total_redeemed_points,
        available_points
      FROM netst_customers_table
      WHERE LOWER(TRIM(COALESCE(customer_referral_code, ''))) = LOWER(TRIM($1))
      LIMIT 1
    `,
    [normalizedCode]
  );

  return result.rows[0] || null;
}

async function awardReferralEvent(db, {
  customerId,
  receiverEmail,
  eventId,
  eventName,
  comments,
  referFriendId = null,
  pointsEarned,
  pointsLeft,
  pointsExpirationDate,
  pointsExpirationDaysValue,
}) {
  await db.query(
    `
      INSERT INTO netst_customer__event_details_table (
        customer_id,
        date_created,
        event_name,
        points_earned,
        points_redeemed,
        points_left,
        transaction_id,
        amount,
        gift_code,
        receiver_email,
        refer_friend_id,
        comments,
        points_expiration_date,
        points_expiration_days,
        expired,
        points_type,
        created_at,
        updated_at,
        event_id
      )
      VALUES (
        $1, CURRENT_DATE, $2, $3, 0, $4, NULL, 0, NULL, $5, $6, $7, $8, $9, FALSE, 'positive', NOW(), NOW(), $10
      )
    `,
    [
      toNumber(customerId, 0),
      eventName,
      pointsEarned,
      pointsLeft,
      receiverEmail,
      referFriendId ? toNumber(referFriendId, 0) : null,
      comments,
      pointsExpirationDate,
      pointsExpirationDaysValue,
      eventId,
    ]
  );
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const pendingEmailNotifications = [];

    await ensureFeaturesTable(client);
    await ensureCustomersTable(client);
    await ensureEventDetailsTable(client);
    await ensureEventsTable(client);
    await ensureConfigTable(client);

    const source = cleanText(req.body?.source).toLowerCase();
    const isAdminSave = source === "admin";
    const customerId = parseCustomerId(req.body?.customerId);
    const customerEmail = cleanText(req.body?.customerEmail);
    const requestedCustomerName = cleanText(req.body?.customerName);
    const birthday = normalizeDate(req.body?.birthday);
    const anniversary = normalizeDate(req.body?.anniversary);
    const hasEligibleForLoyalty = hasOwn(req.body, "eligibleForLoyalty");
    const requestedEligibleForLoyalty = Boolean(req.body?.eligibleForLoyalty);
    const hasReferralCode = hasOwn(req.body, "referralCode");
    const hasUsedReferralCode = hasOwn(req.body, "usedReferralCode");
    const requestedReferralCode = cleanText(req.body?.referralCode);
    const requestedUsedReferralCode = cleanText(req.body?.usedReferralCode);
    const hasEarnedPoints = hasOwn(req.body, "totalEarnedPoints");
    const hasRedeemedPoints = hasOwn(req.body, "totalRedeemedPoints");
    const hasAvailablePoints = hasOwn(req.body, "availablePoints");

    if (!customerId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "customerId is required" });
    }

    const customerRes = await client.query(
      `
        SELECT
          id,
          customer_name,
          customer_email,
          customer_referral_code,
          customer_used_referral_code,
          customer_eligible_for_loyalty,
          total_earned_points,
          total_redeemed_points,
          available_points
        FROM netst_customers_table
        WHERE (
          customer_id = $1
          OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
          OR ($2::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2)))
        )
        ORDER BY
          CASE
            WHEN customer_id = $1 THEN 1
            WHEN regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1 THEN 2
            WHEN ($2::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2))) THEN 3
            ELSE 4
          END,
          updated_at DESC NULLS LAST,
          id DESC
        LIMIT 1
      `,
      [customerId, customerEmail]
    );

    const existingCustomer = customerRes.rows[0] || {};
    const featureFlags = await loadProfileFeatureFlags(client);
    const finalCustomerEmail = customerEmail || cleanText(existingCustomer.customer_email) || null;
    const customerName = normalizeCustomerName(
      requestedCustomerName || cleanText(existingCustomer.customer_name),
      finalCustomerEmail,
      customerId
    );
    const finalEligibleForLoyalty = hasEligibleForLoyalty
      ? requestedEligibleForLoyalty
      : Boolean(existingCustomer.customer_eligible_for_loyalty);
    const existingReferralCode = cleanText(existingCustomer.customer_referral_code) || null;
    const finalReferralCode = hasReferralCode
      ? requestedReferralCode || null
      : existingReferralCode;
    const finalUsedReferralCode = hasUsedReferralCode
      ? requestedUsedReferralCode || null
      : cleanText(existingCustomer.customer_used_referral_code) || null;
    const customerEligible = Boolean(existingCustomer.customer_eligible_for_loyalty);
    const canUseProfileInfo =
      featureFlags.globalLoyaltyEnabled &&
      featureFlags.profileInfoEnabled &&
      customerEligible;
    let totalEarnedPoints = hasEarnedPoints
      ? toNumber(req.body?.totalEarnedPoints, 0)
      : toNumber(existingCustomer.total_earned_points, 0);
    let totalRedeemedPoints = hasRedeemedPoints
      ? toNumber(req.body?.totalRedeemedPoints, 0)
      : toNumber(existingCustomer.total_redeemed_points, 0);
    let availablePoints = hasAvailablePoints
      ? toNumber(req.body?.availablePoints, 0)
      : toNumber(existingCustomer.available_points, 0);
    let resolvedReferralCode = finalReferralCode;
    let newPointsAwarded = 0;
    const awardedEvents = [];
    const skippedEvents = [];

    if (!resolvedReferralCode) {
      resolvedReferralCode = await generateUniqueReferralCode(client, customerId, customerName);
    }

    if (!isAdminSave && !canUseProfileInfo) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "This feature is disabled temporaryly.",
      });
    }

    if (!isAdminSave && finalUsedReferralCode && !featureFlags.referralCodeAtSignupEnabled) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "This feature is disabled temporaryly.",
      });
    }

    if (
      !isAdminSave &&
      !birthday &&
      !anniversary &&
      (!featureFlags.referralCodeAtSignupEnabled || !requestedUsedReferralCode)
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: featureFlags.referralCodeAtSignupEnabled
          ? "Provide birthday, anniversary, or a referral code."
          : "Provide birthday or anniversary.",
      });
    }

    if (!isAdminSave) {
      const config = await loadProfileAwardConfig(client);
      const birthdayEvent = await ensureEventDefinition(client, 9, "Points Earned on Birthday");
      const anniversaryEvent = await ensureEventDefinition(client, 10, "Points Earned on Anniversary");
      const referredSignupEvent = await loadEventDefinition(client, 13);
      const referrerRewardEvent = await ensureEventDefinition(
        client,
        5,
        "Points Earned on Referred Friend Sign up"
      );

      if (!birthdayEvent?.name || !anniversaryEvent?.name || !referredSignupEvent?.name || !referrerRewardEvent?.name) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Required loyalty events are missing in netst_events_table.",
        });
      }

      const pointsExpirationDate = buildPointsExpirationDate(config.pointsExpirationDays);
      const pointsExpirationDaysValue =
        config.pointsExpirationDays > 0 ? String(config.pointsExpirationDays) : null;

      if (finalUsedReferralCode) {
        const alreadyUsedCode = cleanText(existingCustomer.customer_used_referral_code);
        if (alreadyUsedCode && alreadyUsedCode.toLowerCase() === finalUsedReferralCode.toLowerCase()) {
          skippedEvents.push({
            id: referredSignupEvent.id,
            name: referredSignupEvent.name,
            reason: "already_used_referral_code",
          });
        } else {
          const referrer = await loadCustomerByReferralCode(client, finalUsedReferralCode);

          if (!referrer) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Invalid referral code." });
          }

          if (cleanText(referrer.customer_id) === customerId) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "You cannot use your own referral code." });
          }

          const signupAwardExists = await client.query(
            `
              SELECT id
              FROM netst_customer__event_details_table
              WHERE customer_id = $1
                AND event_id = $2
                AND LOWER(TRIM(COALESCE(comments, ''))) = LOWER(TRIM($3))
              LIMIT 1
            `,
            [toNumber(customerId, 0), referredSignupEvent.id, `Referral code used: ${finalUsedReferralCode}`]
          );

          if (!signupAwardExists.rows.length) {
            const referralPoints = Math.max(0, toNumber(config.referralPoints, 0));

            if (referralPoints > 0) {
              totalEarnedPoints += referralPoints;
              availablePoints = totalEarnedPoints - totalRedeemedPoints;
              newPointsAwarded += referralPoints;

              await awardReferralEvent(client, {
                customerId,
                receiverEmail: finalCustomerEmail,
                eventId: referredSignupEvent.id,
                eventName: referredSignupEvent.name,
                comments: `Referral code used: ${finalUsedReferralCode}`,
                referFriendId: referrer.customer_id,
                pointsEarned: referralPoints,
                pointsLeft: availablePoints,
                pointsExpirationDate,
                pointsExpirationDaysValue,
              });

              awardedEvents.push({
                id: referredSignupEvent.id,
                name: referredSignupEvent.name,
                pointsEarned: referralPoints,
              });
              pendingEmailNotifications.push({
                recipientEmail: finalCustomerEmail,
                customerName,
                eventName: referredSignupEvent.name,
                points: referralPoints,
                availablePoints,
                comments: `Referral code used: ${finalUsedReferralCode}`,
              });

              const referrerEarned = toNumber(referrer.total_earned_points, 0) + referralPoints;
              const referrerRedeemed = toNumber(referrer.total_redeemed_points, 0);
              const referrerAvailable = referrerEarned - referrerRedeemed;

              await awardReferralEvent(client, {
                customerId: referrer.customer_id,
                receiverEmail: cleanText(referrer.customer_email) || null,
                eventId: referrerRewardEvent.id,
                eventName: referrerRewardEvent.name,
                comments: `Referral reward for customer ${customerId}`,
                referFriendId: customerId,
                pointsEarned: referralPoints,
                pointsLeft: referrerAvailable,
                pointsExpirationDate,
                pointsExpirationDaysValue,
              });

              await client.query(
                `
                  UPDATE netst_customers_table
                  SET
                    total_earned_points = $1,
                    available_points = $2,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE customer_id = $3
                `,
                [referrerEarned, referrerAvailable, cleanText(referrer.customer_id)]
              );
              pendingEmailNotifications.push({
                recipientEmail: cleanText(referrer.customer_email) || null,
                customerName: cleanText(referrer.customer_name) || "Customer",
                eventName: referrerRewardEvent.name,
                points: referralPoints,
                availablePoints: referrerAvailable,
                comments: `Referral reward for customer ${customerId}`,
              });
            }
          } else {
            skippedEvents.push({
              id: referredSignupEvent.id,
              name: referredSignupEvent.name,
              reason: "referral_already_awarded",
            });
          }
        }
      }

      if (birthday) {
        skippedEvents.push({
          id: birthdayEvent.id,
          name: birthdayEvent.name,
          reason: "scheduled_for_award_date",
        });
      }

      if (anniversary) {
        skippedEvents.push({
          id: anniversaryEvent.id,
          name: anniversaryEvent.name,
          reason: "scheduled_for_award_date",
        });
      }
    }

    if (isAdminSave && !customerEligible && finalEligibleForLoyalty) {
      const config = await loadProfileAwardConfig(client);
      const adminEligibleEvent = await loadEventDefinition(client, 6);

      if (!adminEligibleEvent?.name) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Required loyalty event is missing in netst_events_table.",
        });
      }

      const signupPoints = Math.max(0, toNumber(config.customerSignupPoints, 0));
      if (signupPoints > 0) {
        const adminEligibilityAwardExists = await client.query(
          `
            SELECT id
            FROM netst_customer__event_details_table
            WHERE customer_id = $1
              AND event_id = $2
              AND LOWER(TRIM(COALESCE(comments, ''))) = LOWER(TRIM($3))
            LIMIT 1
          `,
          [toNumber(customerId, 0), adminEligibleEvent.id, "Customer marked eligible by admin"]
        );

        if (!adminEligibilityAwardExists.rows.length) {
          totalEarnedPoints += signupPoints;
          availablePoints = totalEarnedPoints - totalRedeemedPoints;
          newPointsAwarded += signupPoints;

          await awardReferralEvent(client, {
            customerId,
            receiverEmail: finalCustomerEmail,
            eventId: adminEligibleEvent.id,
            eventName: adminEligibleEvent.name,
            comments: "Customer marked eligible by admin",
            pointsEarned: signupPoints,
            pointsLeft: availablePoints,
            pointsExpirationDate: buildPointsExpirationDate(config.pointsExpirationDays),
            pointsExpirationDaysValue:
              config.pointsExpirationDays > 0 ? String(config.pointsExpirationDays) : null,
          });

          awardedEvents.push({
            id: adminEligibleEvent.id,
            name: adminEligibleEvent.name,
            pointsEarned: signupPoints,
          });
          pendingEmailNotifications.push({
            recipientEmail: finalCustomerEmail,
            customerName,
            eventName: adminEligibleEvent.name,
            points: signupPoints,
            availablePoints,
            comments: "Customer marked eligible by admin",
          });
        }
      }
    }

    const saveCustomerRes = await client.query(
      `
        INSERT INTO netst_customers_table (
          customer_id,
          customer_name,
          customer_email,
          customer_birthday,
          customer_anniversary,
          customer_eligible_for_loyalty,
          customer_referral_code,
          customer_used_referral_code,
          total_earned_points,
          total_redeemed_points,
          available_points,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        ON CONFLICT (customer_id)
        DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          customer_email = EXCLUDED.customer_email,
          customer_birthday = EXCLUDED.customer_birthday,
          customer_anniversary = EXCLUDED.customer_anniversary,
          customer_eligible_for_loyalty = EXCLUDED.customer_eligible_for_loyalty,
          customer_referral_code = EXCLUDED.customer_referral_code,
          customer_used_referral_code = EXCLUDED.customer_used_referral_code,
          total_earned_points = EXCLUDED.total_earned_points,
          total_redeemed_points = EXCLUDED.total_redeemed_points,
          available_points = EXCLUDED.available_points,
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          customer_id,
          customer_name,
          customer_email,
          customer_birthday,
          customer_anniversary,
          customer_eligible_for_loyalty,
          customer_referral_code,
          customer_used_referral_code,
          total_earned_points,
          total_redeemed_points,
          available_points
      `,
      [
        customerId,
        customerName,
        finalCustomerEmail,
        birthday,
        anniversary,
        finalEligibleForLoyalty,
        resolvedReferralCode,
        finalUsedReferralCode,
        totalEarnedPoints,
        totalRedeemedPoints,
        availablePoints,
      ]
    );

    if (finalCustomerEmail) {
      await client.query(
        `
          DELETE FROM netst_customers_table
          WHERE customer_id <> $1
            AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2))
            AND (
              TRIM(COALESCE(customer_birthday::text, '')) = ''
              OR customer_birthday IS NULL
            )
            AND (
              TRIM(COALESCE(customer_anniversary::text, '')) = ''
              OR customer_anniversary IS NULL
            )
            AND COALESCE(total_earned_points, 0) = 0
            AND COALESCE(total_redeemed_points, 0) = 0
            AND COALESCE(available_points, 0) = 0
        `,
        [customerId, finalCustomerEmail]
      );
    }

    await client.query("COMMIT");

    const row = saveCustomerRes.rows[0];
    for (const notification of pendingEmailNotifications) {
      await sendPointsEarnedEmail(notification).catch((error) =>
        console.error("save-customer-profile earned email error:", error)
      );
    }
    return res.status(200).json({
      success: true,
      message: "Customer profile saved successfully.",
      awardedEvents,
      skippedEvents,
      customer: {
        id: String(row.customer_id || ""),
        name: cleanText(row.customer_name),
        email: cleanText(row.customer_email),
        birthday: row.customer_birthday || null,
        anniversary: row.customer_anniversary || null,
        eligibleForLoyalty: Boolean(row.customer_eligible_for_loyalty),
        referralCode: cleanText(row.customer_referral_code),
        usedReferralCode: cleanText(row.customer_used_referral_code),
        totalEarnedPoints: toNumber(row.total_earned_points, 0),
        totalRedeemedPoints: toNumber(row.total_redeemed_points, 0),
        availablePoints: toNumber(row.available_points, 0),
        newPointsAwarded,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    console.error("save-customer-profile error:", error);
    return res.status(500).json({ error: "Failed to save customer profile" });
  } finally {
    client.release();
  }
}
