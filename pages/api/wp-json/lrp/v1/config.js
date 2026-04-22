import pool from "../../../../../db/db";
import { saveConfig } from "../../../../../models/LoyaltyConfig";

function cleanText(value) {
  return String(value || "").trim();
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes", "on", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "inactive"].includes(normalized)) return false;
  return fallback;
}

function cleanNullableText(value) {
  if (value === undefined || value === null) return null;
  const next = String(value).trim();
  return next === "" ? null : next;
}

async function ensureEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_events_table (
      id BIGSERIAL PRIMARY KEY,
      ns_id TEXT NULL,
      event_id TEXT NOT NULL UNIQUE,
      event_name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE netst_events_table
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
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

async function loadConfigRow() {
  const result = await pool.query(`
    SELECT *
    FROM netst_loyalty_config_table
    ORDER BY id ASC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

async function loadFeaturesRow() {
  await ensureFeaturesTable();

  const result = await pool.query(`
    SELECT *
    FROM netst_features_table
    ORDER BY id ASC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

async function loadEventsRows() {
  await ensureEventsTable();

  const result = await pool.query(`
    SELECT id, ns_id, event_id, event_name, is_active, created_at, updated_at
    FROM netst_events_table
    ORDER BY id DESC
  `);

  return result.rows.map((row) => ({
    id: Number(row.id),
    nsId: row.ns_id || "",
    eventId: row.event_id || "",
    eventName: row.event_name || "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));
}

async function saveFeatures(featuresInput) {
  await ensureFeaturesTable();

  const existing = await pool.query(
    "SELECT * FROM netst_features_table ORDER BY id ASC LIMIT 1"
  );
  const current = existing.rows[0] || {};

  const finalData = {
    loyalty_eligible: toBoolean(
      featuresInput?.loyaltyEligible ?? featuresInput?.loyalty_eligible,
      current.loyalty_eligible ?? false
    ),
    product_sharing_through_email: toBoolean(
      featuresInput?.productSharingThroughEmail ?? featuresInput?.product_sharing_through_email,
      current.product_sharing_through_email ?? false
    ),
    enable_referral_code_use_at_signup: toBoolean(
      featuresInput?.enableReferralCodeUseAtSignup ?? featuresInput?.enable_referral_code_use_at_signup,
      current.enable_referral_code_use_at_signup ?? false
    ),
    login_to_see_points: toBoolean(
      featuresInput?.loginToSeePoints ?? featuresInput?.login_to_see_points,
      current.login_to_see_points ?? false
    ),
    enable_redeem_history: toBoolean(
      featuresInput?.enableRedeemHistory ?? featuresInput?.enable_redeem_history,
      current.enable_redeem_history ?? false
    ),
    enable_refer_friend: toBoolean(
      featuresInput?.enableReferFriend ?? featuresInput?.enable_refer_friend,
      current.enable_refer_friend ?? false
    ),
    enable_gift_certificate_generation: toBoolean(
      featuresInput?.enableGiftCertificateGeneration ?? featuresInput?.enable_gift_certificate_generation,
      current.enable_gift_certificate_generation ?? false
    ),
    enable_tiers_info: toBoolean(
      featuresInput?.enableTiersInfo ?? featuresInput?.enable_tiers_info,
      current.enable_tiers_info ?? false
    ),
    enable_profile_info: toBoolean(
      featuresInput?.enableProfileInfo ?? featuresInput?.enable_profile_info,
      current.enable_profile_info ?? false
    ),
    enable_points_redeem_on_checkout: toBoolean(
      featuresInput?.enablePointsRedeemOnCheckout ?? featuresInput?.enable_points_redeem_on_checkout,
      current.enable_points_redeem_on_checkout ?? false
    ),
    my_account_tab_heading: cleanNullableText(
      featuresInput?.myAccountTabHeading ?? featuresInput?.my_account_tab_heading ?? current.my_account_tab_heading
    ),
    loyalty_points_earned_label: cleanNullableText(
      featuresInput?.loyaltyPointsEarnedLabel ??
        featuresInput?.loyalty_points_earned_label ??
        current.loyalty_points_earned_label
    ),
    redeem_history_label: cleanNullableText(
      featuresInput?.redeemHistoryLabel ?? featuresInput?.redeem_history_label ?? current.redeem_history_label
    ),
    refer_friend_label: cleanNullableText(
      featuresInput?.referFriendLabel ?? featuresInput?.refer_friend_label ?? current.refer_friend_label
    ),
    gift_card_label: cleanNullableText(
      featuresInput?.giftCardLabel ?? featuresInput?.gift_card_label ?? current.gift_card_label
    ),
    tiers_label: cleanNullableText(featuresInput?.tiersLabel ?? featuresInput?.tiers_label ?? current.tiers_label),
    update_profile_label: cleanNullableText(
      featuresInput?.updateProfileLabel ?? featuresInput?.update_profile_label ?? current.update_profile_label
    ),
    product_redeem_label: cleanNullableText(
      featuresInput?.productRedeemLabel ?? featuresInput?.product_redeem_label ?? current.product_redeem_label
    ),
  };

  if (!existing.rows.length) {
    await pool.query(
      `
      INSERT INTO netst_features_table (
        loyalty_eligible,
        product_sharing_through_email,
        enable_referral_code_use_at_signup,
        login_to_see_points,
        enable_redeem_history,
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
        update_profile_label,
        product_redeem_label,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,
        NOW(),NOW()
      )
      `,
      [
        finalData.loyalty_eligible,
        finalData.product_sharing_through_email,
        finalData.enable_referral_code_use_at_signup,
        finalData.login_to_see_points,
        finalData.enable_redeem_history,
        finalData.enable_refer_friend,
        finalData.enable_gift_certificate_generation,
        finalData.enable_tiers_info,
        finalData.enable_profile_info,
        finalData.enable_points_redeem_on_checkout,
        finalData.my_account_tab_heading,
        finalData.loyalty_points_earned_label,
        finalData.redeem_history_label,
        finalData.refer_friend_label,
        finalData.gift_card_label,
        finalData.tiers_label,
        finalData.update_profile_label,
        finalData.product_redeem_label,
      ]
    );
    return;
  }

  await pool.query(
    `
    UPDATE netst_features_table
    SET
      loyalty_eligible = $1,
      product_sharing_through_email = $2,
      enable_referral_code_use_at_signup = $3,
      login_to_see_points = $4,
      enable_redeem_history = $5,
      enable_refer_friend = $6,
      enable_gift_certificate_generation = $7,
      enable_tiers_info = $8,
      enable_profile_info = $9,
      enable_points_redeem_on_checkout = $10,
      my_account_tab_heading = $11,
      loyalty_points_earned_label = $12,
      redeem_history_label = $13,
      refer_friend_label = $14,
      gift_card_label = $15,
      tiers_label = $16,
      update_profile_label = $17,
      product_redeem_label = $18,
      updated_at = NOW()
    WHERE id = $19
    `,
    [
      finalData.loyalty_eligible,
      finalData.product_sharing_through_email,
      finalData.enable_referral_code_use_at_signup,
      finalData.login_to_see_points,
      finalData.enable_redeem_history,
      finalData.enable_refer_friend,
      finalData.enable_gift_certificate_generation,
      finalData.enable_tiers_info,
      finalData.enable_profile_info,
      finalData.enable_points_redeem_on_checkout,
      finalData.my_account_tab_heading,
      finalData.loyalty_points_earned_label,
      finalData.redeem_history_label,
      finalData.refer_friend_label,
      finalData.gift_card_label,
      finalData.tiers_label,
      finalData.update_profile_label,
      finalData.product_redeem_label,
      current.id,
    ]
  );
}

async function upsertEvent(eventInput) {
  const id = eventInput?.id ? Number(eventInput.id) : null;
  const eventId = cleanText(eventInput?.eventId);
  const eventName = cleanText(eventInput?.eventName);
  const nsId = cleanText(eventInput?.nsId) || null;
  const isActive = toBoolean(eventInput?.isActive, true);

  if (!eventId || !eventName) {
    throw new Error("Each event requires eventId and eventName.");
  }

  if (id) {
    await pool.query(
      `
      UPDATE netst_events_table
      SET
        ns_id = $1,
        event_id = $2,
        event_name = $3,
        is_active = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [nsId, eventId, eventName, isActive, id]
    );

    return { id, eventId, eventName, nsId: nsId || "", isActive };
  }

  const result = await pool.query(
    `
    INSERT INTO netst_events_table (ns_id, event_id, event_name, is_active)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (event_id)
    DO UPDATE SET
      ns_id = EXCLUDED.ns_id,
      event_name = EXCLUDED.event_name,
      is_active = EXCLUDED.is_active,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, ns_id, event_id, event_name, is_active
    `,
    [nsId, eventId, eventName, isActive]
  );

  const row = result.rows[0] || {};
  return {
    id: Number(row.id || 0),
    eventId: row.event_id || eventId,
    eventName: row.event_name || eventName,
    nsId: row.ns_id || "",
    isActive: Boolean(row.is_active),
  };
}

async function deleteEvents(deleteInput) {
  const raw = deleteInput && typeof deleteInput === "object" ? deleteInput : {};

  const ids = Array.isArray(raw.ids) ? raw.ids : raw.id !== undefined ? [raw.id] : [];
  const eventIds = Array.isArray(raw.eventIds)
    ? raw.eventIds
    : raw.eventId !== undefined
      ? [raw.eventId]
      : [];

  const normalizedIds = ids
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const normalizedEventIds = eventIds
    .map((value) => cleanText(value))
    .filter(Boolean);

  if (!normalizedIds.length && !normalizedEventIds.length) {
    throw new Error("Send id, ids, eventId, or eventIds to delete events.");
  }

  const deleted = [];

  if (normalizedIds.length) {
    const result = await pool.query(
      `
      DELETE FROM netst_events_table
      WHERE id = ANY($1::bigint[])
      RETURNING id, event_id, event_name
      `,
      [normalizedIds]
    );
    deleted.push(
      ...result.rows.map((row) => ({
        id: Number(row.id),
        eventId: row.event_id || "",
        eventName: row.event_name || "",
      }))
    );
  }

  if (normalizedEventIds.length) {
    const result = await pool.query(
      `
      DELETE FROM netst_events_table
      WHERE event_id = ANY($1::text[])
      RETURNING id, event_id, event_name
      `,
      [normalizedEventIds]
    );
    deleted.push(
      ...result.rows.map((row) => ({
        id: Number(row.id),
        eventId: row.event_id || "",
        eventName: row.event_name || "",
      }))
    );
  }

  return deleted;
}

function normalizeRequestPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  const configInput = raw.config && typeof raw.config === "object" ? raw.config : raw;

  const events = Array.isArray(raw.events)
    ? raw.events
    : raw.event && typeof raw.event === "object"
      ? [raw.event]
      : [];
  const features = raw.features && typeof raw.features === "object" ? raw.features : null;

  const config = {
    signup: configInput.signup ?? configInput.customer_signup_points,
    referral: configInput.referral ?? configInput.referral_points,
    birthday: configInput.birthday ?? configInput.birthday_points,
    anniversary: configInput.anniversary ?? configInput.anniversary_points,
    pointValue: configInput.pointValue ?? configInput.each_point_value,
    equivalent: configInput.equivalent ?? configInput.loyalty_point_value,
    pointsExpiry: configInput.pointsExpiry ?? configInput.points_expiration_days,
    giftcardExpiry: configInput.giftcardExpiry ?? configInput.giftcard_expiry_days,
    netsuiteEndpoint: configInput.netsuiteEndpoint ?? configInput.netsuite_endpoint_url,
    threshold: configInput.threshold ?? configInput.minimum_redemption_points,
    email: configInput.email ?? configInput.email_share_points,
    facebook: configInput.facebook ?? configInput.facebook_share_points,
  };

  return { config, events, features };
}

function normalizeDeletePayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  return raw.delete && typeof raw.delete === "object" ? raw.delete : raw;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const [config, events, features] = await Promise.all([
        loadConfigRow(),
        loadEventsRows(),
        loadFeaturesRow(),
      ]);
      return res.status(200).json({ success: true, config, events, features });
    } catch (error) {
      console.error("wp-json/lrp/v1/config GET error:", error);
      return res.status(500).json({ success: false, error: "Failed to load config data" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await ensureEventsTable();

      const deletedEvents = await deleteEvents(normalizeDeletePayload(req.body));
      const [latestConfig, latestEvents, latestFeatures] = await Promise.all([
        loadConfigRow(),
        loadEventsRows(),
        loadFeaturesRow(),
      ]);

      return res.status(200).json({
        success: true,
        deletedEventsCount: deletedEvents.length,
        deletedEvents,
        config: latestConfig,
        events: latestEvents,
        features: latestFeatures,
      });
    } catch (error) {
      console.error("wp-json/lrp/v1/config delete error:", error);
      return res.status(500).json({
        success: false,
        error: cleanText(error?.message) || "Failed to delete events",
      });
    }
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    await ensureEventsTable();

    const { config, events, features } = normalizeRequestPayload(req.body);
    const hasConfigPayload = Object.values(config || {}).some((value) => value !== undefined);
    const hasFeaturesPayload = features && Object.values(features).some((value) => value !== undefined);

    if (!hasConfigPayload && !events.length && !hasFeaturesPayload) {
      return res.status(400).json({
        success: false,
        error: "Send config fields, features object, events array, or any combination.",
      });
    }

    if (hasConfigPayload) {
      await saveConfig(config);
    }

    if (hasFeaturesPayload) {
      await saveFeatures(features);
    }

    const savedEvents = [];
    for (const event of events) {
      savedEvents.push(await upsertEvent(event));
    }

    const [latestConfig, latestEvents, latestFeatures] = await Promise.all([
      loadConfigRow(),
      loadEventsRows(),
      loadFeaturesRow(),
    ]);

    return res.status(200).json({
      success: true,
      updatedConfig: hasConfigPayload,
      updatedFeatures: Boolean(hasFeaturesPayload),
      updatedEventsCount: savedEvents.length,
      savedEvents,
      config: latestConfig,
      events: latestEvents,
      features: latestFeatures,
    });
  } catch (error) {
    console.error("wp-json/lrp/v1/config save error:", error);
    return res.status(500).json({
      success: false,
      error: cleanText(error?.message) || "Failed to save config data",
    });
  }
}
