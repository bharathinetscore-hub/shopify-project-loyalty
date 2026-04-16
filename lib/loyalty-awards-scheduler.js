const pool = require("../db/db");

const TIMEZONE = process.env.LOYALTY_AWARD_TIMEZONE || "Asia/Kolkata";
const RUN_AFTER_HOUR = Number.parseInt(process.env.LOYALTY_AWARD_RUN_HOUR || "14", 10);
const RUN_AFTER_MINUTE = Number.parseInt(process.env.LOYALTY_AWARD_RUN_MINUTE || "20", 10);
const CHECK_INTERVAL_MS = 60 * 1000;

let schedulerStarted = false;
let activeRun = null;
let lastCompletedLocalDate = "";
let lastRunSummary = {
  startedAt: null,
  completedAt: null,
  localDate: "",
  monthDay: "",
  forced: false,
  skipped: false,
  skipReason: "",
  awards: 0,
  matchedCustomers: 0,
  checkedCustomers: 0,
  config: null,
  error: null,
};

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWholeNumber(value, fallback = 0) {
  return Math.max(0, Math.floor(toNumber(value, fallback)));
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeMonthDay(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateOnly(value).slice(5, 10);
  }

  const raw = cleanText(value);
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw.slice(5, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateOnly(parsed).slice(5, 10);
  }

  return "";
}

function buildPointsExpirationDate(days) {
  const safeDays = normalizeWholeNumber(days, 0);
  if (!safeDays) return null;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + safeDays);
  return formatDateOnly(nextDate);
}

function getLocalDateParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: cleanText(parts.year),
    month: cleanText(parts.month),
    day: cleanText(parts.day),
    hour: Number.parseInt(parts.hour || "0", 10),
    minute: Number.parseInt(parts.minute || "0", 10),
    second: Number.parseInt(parts.second || "0", 10),
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    monthDay: `${parts.month}-${parts.day}`,
  };
}

function shouldRunForLocalDate(parts) {
  if (!parts?.localDate) return false;
  if (lastCompletedLocalDate === parts.localDate) return false;
  if (parts.hour < RUN_AFTER_HOUR) return false;
  if (parts.hour === RUN_AFTER_HOUR && parts.minute < RUN_AFTER_MINUTE) return false;
  return true;
}

function buildSchedulerStatus(now = new Date()) {
  const parts = getLocalDateParts(now);
  return {
    schedulerStarted,
    activeRun: Boolean(activeRun),
    timezone: TIMEZONE,
    runAfterHour: RUN_AFTER_HOUR,
    runAfterMinute: RUN_AFTER_MINUTE,
    currentLocalParts: parts,
    shouldRunNow: shouldRunForLocalDate(parts),
    lastCompletedLocalDate,
    lastRunSummary,
  };
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

  await db.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_birthday DATE NULL
  `);
  await db.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS customer_anniversary DATE NULL
  `);
  await db.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS total_earned_points NUMERIC(12,2) NOT NULL DEFAULT 0
  `);
  await db.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0
  `);
  await db.query(`
    ALTER TABLE netst_customers_table
    ADD COLUMN IF NOT EXISTS available_points NUMERIC(12,2) NOT NULL DEFAULT 0
  `);
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
}

async function ensureConfigTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS netst_loyalty_config_table (
      id SERIAL PRIMARY KEY,
      birthday_points NUMERIC(10,2) DEFAULT 0.00,
      anniversary_points NUMERIC(10,2) DEFAULT 0.00,
      points_expiration_days VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
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

async function loadProfileAwardConfig(db) {
  const result = await db.query(
    `
      SELECT birthday_points, anniversary_points, points_expiration_days
      FROM netst_loyalty_config_table
      ORDER BY id DESC
      LIMIT 1
    `
  );

  const row = result.rows[0] || {};
  return {
    birthdayPoints: toNumber(row.birthday_points, 0),
    anniversaryPoints: toNumber(row.anniversary_points, 0),
    pointsExpirationDays: normalizeWholeNumber(row.points_expiration_days, 0),
  };
}

async function ensureEventDefinition(db, eventId, fallbackName) {
  const result = await db.query(
    `
      INSERT INTO netst_events_table (event_id, event_name, is_active, created_at, updated_at)
      VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id)
      DO UPDATE SET
        event_name = COALESCE(NULLIF(netst_events_table.event_name, ''), EXCLUDED.event_name),
        updated_at = CURRENT_TIMESTAMP
      RETURNING event_id, event_name
    `,
    [String(eventId), fallbackName]
  );

  const row = result.rows[0] || {};
  return {
    id: toNumber(row.event_id, eventId),
    name: cleanText(row.event_name) || fallbackName,
  };
}

async function hasAwardForYear(db, customerNumericId, eventId, startDate, endDate) {
  const result = await db.query(
    `
      SELECT 1
      FROM netst_customer__event_details_table
      WHERE customer_id = $1
        AND event_id = $2
        AND points_type = 'positive'
        AND date_created >= $3::date
        AND date_created <= $4::date
      LIMIT 1
    `,
    [customerNumericId, eventId, startDate, endDate]
  );

  return Boolean(result.rows.length);
}

async function insertAwardEvent(db, {
  customerNumericId,
  customerEmail,
  eventId,
  eventName,
  pointsEarned,
  pointsLeft,
  comments,
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
        $1, CURRENT_DATE, $2, $3, 0, $4, $5, 0, NULL, $6, NULL, $7, $8, $9, FALSE, 'positive', NOW(), NOW(), $10
      )
    `,
    [
      customerNumericId,
      eventName,
      pointsEarned,
      pointsLeft,
      Date.now(),
      customerEmail,
      comments,
      pointsExpirationDate,
      pointsExpirationDaysValue,
      eventId,
    ]
  );
}

async function awardScheduledProfilePoints({ force = false } = {}) {
  const localParts = getLocalDateParts();
  if (!force && !shouldRunForLocalDate(localParts)) {
    lastRunSummary = {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      localDate: localParts.localDate,
      monthDay: localParts.monthDay,
      forced: false,
      skipped: true,
      skipReason: "outside_run_window_or_already_completed",
      awards: 0,
      matchedCustomers: 0,
      checkedCustomers: 0,
      config: null,
      error: null,
    };
    return;
  }

  if (activeRun) {
    return activeRun;
  }

  activeRun = (async () => {
    const client = await pool.connect();
    const runStartedAt = new Date().toISOString();

    try {
      await client.query("BEGIN");

      await ensureCustomersTable(client);
      await ensureEventDetailsTable(client);
      await ensureEventsTable(client);
      await ensureConfigTable(client);

      const config = await loadProfileAwardConfig(client);
      const birthdayEvent = await ensureEventDefinition(client, 9, "Points Earned on Birthday");
      const anniversaryEvent = await ensureEventDefinition(client, 10, "Points Earned on Anniversary");
      const pointsExpirationDate = buildPointsExpirationDate(config.pointsExpirationDays);
      const pointsExpirationDaysValue =
        config.pointsExpirationDays > 0 ? String(config.pointsExpirationDays) : null;
      const yearStart = `${localParts.year}-01-01`;
      const yearEnd = `${localParts.year}-12-31`;

      const customersRes = await client.query(
        `
          SELECT
            id,
            customer_id,
            customer_name,
            customer_email,
            customer_birthday,
            customer_anniversary,
            total_earned_points,
            total_redeemed_points,
            available_points
          FROM netst_customers_table
          WHERE customer_birthday IS NOT NULL
             OR customer_anniversary IS NOT NULL
          ORDER BY id ASC
        `
      );

      let totalAwards = 0;
      let matchedCustomers = 0;

      for (const customer of customersRes.rows) {
        const customerNumericId = toNumber(parseCustomerId(customer.customer_id), 0);
        if (!customerNumericId) {
          continue;
        }

        const eventsToCheck = [];
        const birthdayMonthDay = normalizeMonthDay(customer.customer_birthday);
        const anniversaryMonthDay = normalizeMonthDay(customer.customer_anniversary);

        if (birthdayMonthDay === localParts.monthDay && config.birthdayPoints > 0) {
          eventsToCheck.push({
            eventId: birthdayEvent.id,
            eventName: birthdayEvent.name,
            points: config.birthdayPoints,
            comments: `Scheduled birthday reward for ${localParts.localDate}`,
          });
        }

        if (anniversaryMonthDay === localParts.monthDay && config.anniversaryPoints > 0) {
          eventsToCheck.push({
            eventId: anniversaryEvent.id,
            eventName: anniversaryEvent.name,
            points: config.anniversaryPoints,
            comments: `Scheduled anniversary reward for ${localParts.localDate}`,
          });
        }

        if (!eventsToCheck.length) {
          continue;
        }

        matchedCustomers += 1;

        let totalEarnedPoints = toNumber(customer.total_earned_points, 0);
        const totalRedeemedPoints = toNumber(customer.total_redeemed_points, 0);
        let availablePoints = toNumber(customer.available_points, 0);

        for (const event of eventsToCheck) {
          const alreadyAwarded = await hasAwardForYear(
            client,
            customerNumericId,
            event.eventId,
            yearStart,
            yearEnd
          );

          if (alreadyAwarded) {
            continue;
          }

          totalEarnedPoints += toNumber(event.points, 0);
          availablePoints = totalEarnedPoints - totalRedeemedPoints;

          await insertAwardEvent(client, {
            customerNumericId,
            customerEmail: cleanText(customer.customer_email) || null,
            eventId: event.eventId,
            eventName: event.eventName,
            pointsEarned: toNumber(event.points, 0),
            pointsLeft: availablePoints,
            comments: event.comments,
            pointsExpirationDate,
            pointsExpirationDaysValue,
          });

          totalAwards += 1;
        }

        await client.query(
          `
            UPDATE netst_customers_table
            SET
              total_earned_points = $1,
              available_points = $2,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `,
          [totalEarnedPoints, availablePoints, toNumber(customer.id, 0)]
        );
      }

      await client.query("COMMIT");
      if (!force) {
        lastCompletedLocalDate = localParts.localDate;
      }
      lastRunSummary = {
        startedAt: runStartedAt,
        completedAt: new Date().toISOString(),
        localDate: localParts.localDate,
        monthDay: localParts.monthDay,
        forced: Boolean(force),
        skipped: false,
        skipReason: "",
        awards: totalAwards,
        matchedCustomers,
        checkedCustomers: customersRes.rows.length,
        config: {
          birthdayPoints: config.birthdayPoints,
          anniversaryPoints: config.anniversaryPoints,
          pointsExpirationDays: config.pointsExpirationDays,
        },
        error: null,
      };
      console.log(
        `[loyalty-scheduler] completed for ${localParts.localDate} in ${TIMEZONE}; awards=${totalAwards}; matchedCustomers=${matchedCustomers}; checkedCustomers=${customersRes.rows.length}; forced=${force ? "yes" : "no"}`
      );
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // no-op
      }
      lastRunSummary = {
        startedAt: runStartedAt,
        completedAt: new Date().toISOString(),
        localDate: localParts.localDate,
        monthDay: localParts.monthDay,
        forced: Boolean(force),
        skipped: false,
        skipReason: "",
        awards: 0,
        matchedCustomers: 0,
        checkedCustomers: 0,
        config: null,
        error: error?.message || String(error),
      };
      console.error("[loyalty-scheduler] failed:", error);
    } finally {
      client.release();
      activeRun = null;
    }
  })();

  return activeRun;
}

function startLoyaltyAwardsScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  console.log(
    `[loyalty-scheduler] starting daily birthday/anniversary awards in ${TIMEZONE} after ${String(
      RUN_AFTER_HOUR
    ).padStart(2, "0")}:${String(RUN_AFTER_MINUTE).padStart(2, "0")}`
  );

  setTimeout(() => {
    awardScheduledProfilePoints().catch((error) => {
      console.error("[loyalty-scheduler] initial run error:", error);
    });
  }, 5 * 1000);

  setInterval(() => {
    awardScheduledProfilePoints().catch((error) => {
      console.error("[loyalty-scheduler] interval run error:", error);
    });
  }, CHECK_INTERVAL_MS);
}

module.exports = {
  startLoyaltyAwardsScheduler,
  awardScheduledProfilePoints,
  getLoyaltyAwardsSchedulerStatus: buildSchedulerStatus,
};
