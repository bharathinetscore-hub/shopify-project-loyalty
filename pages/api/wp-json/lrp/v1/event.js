import pool from "../../../../../db/db";

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toNullableNumber(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(input) {
  const raw = cleanText(input);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function parseCustomerId(value) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function normalizePointsType(value) {
  return cleanText(value).toLowerCase() === "negative" ? "negative" : "positive";
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (["true", "1", "yes", "on", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "inactive"].includes(normalized)) return false;
  return fallback;
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
  await ensureColumn("total_redeemed_points", "total_redeemed_points NUMERIC(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("available_points", "available_points NUMERIC(12,2) NOT NULL DEFAULT 0");
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

async function loadCustomer(db, customerId, customerEmail) {
  const result = await db.query(
    `
    SELECT *
    FROM netst_customers_table
    WHERE (
      ($1::text <> '' AND (
        customer_id = $1
        OR regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
      ))
      OR ($2::text <> '' AND LOWER(TRIM(COALESCE(customer_email, ''))) = LOWER(TRIM($2)))
    )
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    [customerId, customerEmail]
  );

  return result.rows[0] || null;
}

async function loadEventDefinition(db, eventId) {
  const normalized = cleanText(eventId);
  if (!normalized) return null;

  const result = await db.query(
    `
    SELECT id, event_id, event_name, is_active
    FROM netst_events_table
    WHERE event_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [normalized]
  );

  return result.rows[0] || null;
}

function mapEventRow(row) {
  return {
    id: Number(row.id || 0),
    customerId: row.customer_id != null ? String(row.customer_id) : "",
    date: row.date_created || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    eventName: cleanText(row.event_name),
    amount: toNumber(row.amount, 0),
    pointsEarned: toNumber(row.points_earned, 0),
    pointsRedeemed: toNumber(row.points_redeemed, 0),
    pointsLeft: toNumber(row.points_left, 0),
    pointsType: cleanText(row.points_type) || "positive",
    eventId: row.event_id != null ? String(row.event_id) : "",
    transactionId: row.transaction_id != null ? String(row.transaction_id) : "",
    giftCode: cleanText(row.gift_code),
    receiverEmail: cleanText(row.receiver_email),
    referFriendId: row.refer_friend_id != null ? String(row.refer_friend_id) : "",
    comments: row.comments || "",
    pointsExpirationDate: row.points_expiration_date || null,
    pointsExpirationDays: cleanText(row.points_expiration_days),
    expired: Boolean(row.expired),
  };
}

function mapCustomerRow(row) {
  return {
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
  };
}

function buildNormalizedAmounts(payload) {
  const pointsType = normalizePointsType(payload.pointsType ?? payload.points_type);
  const directEarned = toNullableNumber(payload.pointsEarned ?? payload.points_earned);
  const directRedeemed = toNullableNumber(payload.pointsRedeemed ?? payload.points_redeemed);
  const pointsValue = toNullableNumber(payload.pointsValue);

  let pointsEarned = directEarned;
  let pointsRedeemed = directRedeemed;

  if (pointsEarned == null && pointsRedeemed == null) {
    if (pointsValue == null || pointsValue <= 0) {
      return { error: "pointsValue or pointsEarned/pointsRedeemed is required" };
    }
    if (pointsType === "negative") {
      pointsEarned = 0;
      pointsRedeemed = pointsValue;
    } else {
      pointsEarned = pointsValue;
      pointsRedeemed = 0;
    }
  }

  pointsEarned = Math.max(0, toNumber(pointsEarned, 0));
  pointsRedeemed = Math.max(0, toNumber(pointsRedeemed, 0));

  if (pointsEarned <= 0 && pointsRedeemed <= 0) {
    return { error: "points must be greater than 0" };
  }

  return { pointsType, pointsEarned, pointsRedeemed };
}

function normalizeEventPayload(input) {
  const raw = input && typeof input === "object" ? input : {};
  const normalized = {
    id: toNullableNumber(raw.id),
    customerId: parseCustomerId(raw.customerId ?? raw.customer_id),
    customerEmail: cleanText(raw.customerEmail ?? raw.customer_email ?? raw.email),
    eventId: cleanText(raw.eventId ?? raw.event_id),
    eventName: cleanText(raw.eventName ?? raw.event_name),
    amount: toNumber(raw.amount, 0),
    comments: cleanText(raw.comments),
    dateCreated: normalizeDate(raw.dateCreated ?? raw.date_created),
    transactionId: toNullableNumber(raw.transactionId ?? raw.transaction_id),
    giftCode: cleanText(raw.giftCode ?? raw.gift_code),
    receiverEmail: cleanText(raw.receiverEmail ?? raw.receiver_email),
    referFriendId: toNullableNumber(raw.referFriendId ?? raw.refer_friend_id),
    pointsExpirationDate: normalizeDate(raw.pointsExpirationDate ?? raw.points_expiration_date),
    pointsExpirationDays: cleanText(raw.pointsExpirationDays ?? raw.points_expiration_days),
    expired: toBoolean(raw.expired, false),
  };

  const amounts = buildNormalizedAmounts(raw);
  return { ...normalized, ...amounts };
}

function normalizeEventListPayload(body) {
  const raw = body && typeof body === "object" ? body : {};
  if (Array.isArray(raw.events)) {
    return raw.events.map(normalizeEventPayload);
  }
  return [normalizeEventPayload(raw.event && typeof raw.event === "object" ? raw.event : raw)];
}

async function recalcCustomerLedger(db, customerNumericId) {
  const eventsRes = await db.query(
    `
    SELECT
      id,
      points_earned,
      points_redeemed,
      points_type,
      date_created,
      created_at
    FROM netst_customer__event_details_table
    WHERE customer_id = $1
    ORDER BY COALESCE(date_created, CURRENT_DATE) ASC, COALESCE(created_at, NOW()) ASC, id ASC
    `,
    [customerNumericId]
  );

  let runningBalance = 0;
  let totalEarnedPoints = 0;
  let totalRedeemedPoints = 0;

  for (const row of eventsRes.rows) {
    const type = cleanText(row.points_type).toLowerCase() === "negative" ? "negative" : "positive";
    const earned = toNumber(row.points_earned, 0);
    const redeemed = toNumber(row.points_redeemed, 0);

    if (type === "negative") {
      const redeemValue = redeemed > 0 ? redeemed : Math.abs(earned);
      totalRedeemedPoints += redeemValue;
      runningBalance -= redeemValue;
    } else {
      totalEarnedPoints += earned;
      totalRedeemedPoints += redeemed;
      runningBalance += earned - redeemed;
    }

    await db.query(
      `
      UPDATE netst_customer__event_details_table
      SET
        points_left = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [runningBalance, row.id]
    );
  }

  await db.query(
    `
    UPDATE netst_customers_table
    SET
      total_earned_points = $1,
      total_redeemed_points = $2,
      available_points = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $4
       OR customer_id = $4
    `,
    [totalEarnedPoints, totalRedeemedPoints, runningBalance, String(customerNumericId)]
  );

  const customerRes = await db.query(
    `
    SELECT *
    FROM netst_customers_table
    WHERE regexp_replace(TRIM(COALESCE(customer_id, '')), '\\D', '', 'g') = $1
       OR customer_id = $1
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 1
    `,
    [String(customerNumericId)]
  );

  return customerRes.rows[0] || null;
}

async function createEventSingle(db, payload) {
  if (payload.error) {
    return { status: 400, data: { error: payload.error } };
  }

  if (!payload.customerId && !payload.customerEmail) {
    return { status: 400, data: { error: "customerId or customerEmail is required" } };
  }

  const customer = await loadCustomer(db, payload.customerId, payload.customerEmail);
  if (!customer) {
    return { status: 404, data: { error: "Customer not found" } };
  }

  const eventDefinition = await loadEventDefinition(db, payload.eventId);
  const eventName = payload.eventName || cleanText(eventDefinition?.event_name);
  if (!eventName) {
    return { status: 400, data: { error: "eventId or eventName is required" } };
  }

  const customerNumericId = toNumber(parseCustomerId(customer.customer_id), 0);
  if (!customerNumericId) {
    return { status: 400, data: { error: "Customer has an invalid customer_id" } };
  }

  const insertRes = await db.query(
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
      $1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), $16
    )
    RETURNING *
    `,
    [
      customerNumericId,
      payload.dateCreated || new Date().toISOString().slice(0, 10),
      eventName,
      payload.pointsEarned,
      payload.pointsRedeemed,
      payload.transactionId,
      payload.amount,
      payload.giftCode || null,
      payload.receiverEmail || cleanText(customer.customer_email) || null,
      payload.referFriendId,
      payload.comments || null,
      payload.pointsExpirationDate,
      payload.pointsExpirationDays || null,
      payload.expired,
      payload.pointsType,
      eventDefinition ? toNumber(eventDefinition.event_id, 0) : null,
    ]
  );

  const savedCustomer = await recalcCustomerLedger(db, customerNumericId);
  return {
    status: 201,
    data: {
      event: mapEventRow(insertRes.rows[0] || {}),
      customer: savedCustomer ? mapCustomerRow(savedCustomer) : null,
    },
  };
}

async function updateEventSingle(db, payload) {
  if (payload.error) {
    return { status: 400, data: { error: payload.error } };
  }

  const id = toNumber(payload.id, 0);
  if (!id) {
    return { status: 400, data: { error: "id is required for update" } };
  }

  const existingRes = await db.query(
    `
    SELECT *
    FROM netst_customer__event_details_table
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  const existing = existingRes.rows[0] || null;
  if (!existing) {
    return { status: 404, data: { error: "Event detail not found" } };
  }

  const customer = await loadCustomer(
    db,
    payload.customerId || String(existing.customer_id || ""),
    payload.customerEmail || cleanText(existing.receiver_email)
  );
  if (!customer) {
    return { status: 404, data: { error: "Customer not found" } };
  }

  const eventDefinition = await loadEventDefinition(db, payload.eventId || existing.event_id);
  const nextValues = {
    customerId: toNumber(parseCustomerId(customer.customer_id), 0),
    dateCreated: payload.dateCreated || existing.date_created,
    eventName: payload.eventName || cleanText(eventDefinition?.event_name) || cleanText(existing.event_name),
    pointsEarned: payload.pointsEarned,
    pointsRedeemed: payload.pointsRedeemed,
    transactionId:
      payload.transactionId !== null ? payload.transactionId : toNullableNumber(existing.transaction_id),
    amount: payload.amount !== undefined ? payload.amount : toNumber(existing.amount, 0),
    giftCode: payload.giftCode || cleanText(existing.gift_code),
    receiverEmail: payload.receiverEmail || cleanText(existing.receiver_email),
    referFriendId:
      payload.referFriendId !== null ? payload.referFriendId : toNullableNumber(existing.refer_friend_id),
    comments: payload.comments || cleanText(existing.comments),
    pointsExpirationDate: payload.pointsExpirationDate || existing.points_expiration_date,
    pointsExpirationDays: payload.pointsExpirationDays || cleanText(existing.points_expiration_days),
    expired: payload.expired !== undefined ? payload.expired : Boolean(existing.expired),
    pointsType: payload.pointsType || cleanText(existing.points_type) || "positive",
    eventId: eventDefinition ? toNumber(eventDefinition.event_id, 0) : toNullableNumber(existing.event_id),
  };

  if (!nextValues.customerId) {
    return { status: 400, data: { error: "Customer has an invalid customer_id" } };
  }

  await db.query(
    `
    UPDATE netst_customer__event_details_table
    SET
      customer_id = $1,
      date_created = $2,
      event_name = $3,
      points_earned = $4,
      points_redeemed = $5,
      transaction_id = $6,
      amount = $7,
      gift_code = $8,
      receiver_email = $9,
      refer_friend_id = $10,
      comments = $11,
      points_expiration_date = $12,
      points_expiration_days = $13,
      expired = $14,
      points_type = $15,
      event_id = $16,
      updated_at = NOW()
    WHERE id = $17
    `,
    [
      nextValues.customerId,
      nextValues.dateCreated,
      nextValues.eventName,
      nextValues.pointsEarned,
      nextValues.pointsRedeemed,
      nextValues.transactionId,
      nextValues.amount,
      nextValues.giftCode || null,
      nextValues.receiverEmail || null,
      nextValues.referFriendId,
      nextValues.comments || null,
      nextValues.pointsExpirationDate,
      nextValues.pointsExpirationDays || null,
      nextValues.expired,
      nextValues.pointsType,
      nextValues.eventId,
      id,
    ]
  );

  const impactedIds = [toNumber(existing.customer_id, 0), nextValues.customerId]
    .filter((value, index, arr) => value > 0 && arr.indexOf(value) === index);
  const recalculatedCustomers = [];
  for (const customerId of impactedIds) {
    const savedCustomer = await recalcCustomerLedger(db, customerId);
    if (savedCustomer) recalculatedCustomers.push(mapCustomerRow(savedCustomer));
  }

  const updatedRes = await db.query(
    `
    SELECT *
    FROM netst_customer__event_details_table
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return {
    status: 200,
    data: {
      event: mapEventRow(updatedRes.rows[0] || {}),
      customer: recalculatedCustomers[0] || null,
      customers: recalculatedCustomers,
    },
  };
}

async function deleteEventSingle(db, id) {
  const numericId = toNumber(id, 0);
  if (!numericId) {
    return { status: 400, data: { error: "id is required" } };
  }

  const existingRes = await db.query(
    `
    DELETE FROM netst_customer__event_details_table
    WHERE id = $1
    RETURNING *
    `,
    [numericId]
  );

  const deleted = existingRes.rows[0] || null;
  if (!deleted) {
    return { status: 404, data: { error: "Event detail not found" } };
  }

  const savedCustomer = await recalcCustomerLedger(db, toNumber(deleted.customer_id, 0));
  return {
    status: 200,
    data: {
      message: "Event detail deleted",
      event: mapEventRow(deleted),
      customer: savedCustomer ? mapCustomerRow(savedCustomer) : null,
    },
  };
}

export default async function handler(req, res) {
  const client = await pool.connect();

  try {
    await ensureCustomersTable(client);
    await ensureEventsTable(client);
    await ensureEventDetailsTable(client);

    if (req.method === "GET") {
      const id = toNumber(req.query.id, 0);
      const customerId = parseCustomerId(req.query.customerId);
      const email = cleanText(req.query.email);
      const q = cleanText(req.query.q);

      const conditions = [];
      const values = [];
      let index = 1;

      if (id) {
        conditions.push(`id = $${index}`);
        values.push(id);
        index += 1;
      }
      if (customerId) {
        conditions.push(`customer_id::text = $${index}`);
        values.push(customerId);
        index += 1;
      }
      if (email) {
        conditions.push(`LOWER(TRIM(COALESCE(receiver_email, ''))) = LOWER(TRIM($${index}))`);
        values.push(email);
        index += 1;
      }
      if (q) {
        conditions.push(`(
          event_name ILIKE '%' || $${index} || '%'
          OR CAST(customer_id AS TEXT) ILIKE '%' || $${index} || '%'
          OR COALESCE(receiver_email, '') ILIKE '%' || $${index} || '%'
        )`);
        values.push(q);
        index += 1;
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await client.query(
        `
        SELECT *
        FROM netst_customer__event_details_table
        ${whereClause}
        ORDER BY COALESCE(created_at, NOW()) DESC, id DESC
        LIMIT 1000
        `,
        values
      );

      const events = result.rows.map(mapEventRow);
      return res.status(200).json({
        success: true,
        event: id ? events[0] || null : null,
        events,
      });
    }

    if (req.method === "POST") {
      await client.query("BEGIN");
      const payloads = normalizeEventListPayload(req.body);
      const isBulk = Array.isArray(req.body?.events);

      if (isBulk) {
        const results = [];
        for (const payload of payloads) {
          const result = await createEventSingle(client, payload);
          results.push({ status: result.status, data: result.data });
        }
        await client.query("COMMIT");
        return res.status(200).json(results);
      }

      const result = await createEventSingle(client, payloads[0] || {});
      if (result.status >= 400) {
        await client.query("ROLLBACK");
        return res.status(result.status).json(result.data);
      }
      await client.query("COMMIT");
      return res.status(result.status).json(result.data);
    }

    if (req.method === "PUT") {
      await client.query("BEGIN");
      const payloads = normalizeEventListPayload(req.body);
      const isBulk = Array.isArray(req.body?.events);

      if (isBulk) {
        const results = [];
        for (const payload of payloads) {
          const result = await updateEventSingle(client, payload);
          results.push({ status: result.status, data: result.data });
        }
        await client.query("COMMIT");
        return res.status(200).json(results);
      }

      const result = await updateEventSingle(client, payloads[0] || {});
      if (result.status >= 400) {
        await client.query("ROLLBACK");
        return res.status(result.status).json(result.data);
      }
      await client.query("COMMIT");
      return res.status(result.status).json(result.data);
    }

    if (req.method === "DELETE") {
      await client.query("BEGIN");
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids
        : Array.isArray(req.body?.events)
          ? req.body.events.map((item) => item?.id)
          : [req.body?.id];

      const normalizedIds = ids.map((value) => toNumber(value, 0)).filter((value) => value > 0);

      if (!normalizedIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "id or ids is required" });
      }

      if (normalizedIds.length > 1) {
        const results = [];
        for (const id of normalizedIds) {
          const result = await deleteEventSingle(client, id);
          results.push({ id, status: result.status, data: result.data });
        }
        await client.query("COMMIT");
        return res.status(200).json(results);
      }

      const result = await deleteEventSingle(client, normalizedIds[0]);
      if (result.status >= 400) {
        await client.query("ROLLBACK");
        return res.status(result.status).json(result.data);
      }
      await client.query("COMMIT");
      return res.status(result.status).json(result.data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    console.error("wp-json/lrp/v1/event error:", error);
    return res.status(500).json({ error: "Failed to process event details" });
  } finally {
    client.release();
  }
}
