import pool from "../db/db";
import { EMAIL_TEMPLATE_DEFAULTS, EMAIL_TEMPLATE_KEYS } from "./email-template-definitions";

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export { EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATE_DEFAULTS };

export async function ensureEmailTemplatesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netst_email_template (
      id SERIAL PRIMARY KEY,
      template_key VARCHAR(100) NOT NULL UNIQUE,
      template_name VARCHAR(255) DEFAULT NULL,
      subject TEXT DEFAULT NULL,
      text_body TEXT DEFAULT NULL,
      html_body TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE netst_email_template
    ADD COLUMN IF NOT EXISTS template_name VARCHAR(255) DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE netst_email_template
    ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE netst_email_template
    ADD COLUMN IF NOT EXISTS text_body TEXT DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE netst_email_template
    ADD COLUMN IF NOT EXISTS html_body TEXT DEFAULT NULL
  `);
}

export async function getEmailTemplateMap() {
  await ensureEmailTemplatesTable();

  const result = await pool.query(`
    SELECT template_key, template_name, subject, text_body, html_body, updated_at
    FROM netst_email_template
  `);

  const merged = { ...EMAIL_TEMPLATE_DEFAULTS };
  for (const row of result.rows) {
    const key = cleanText(row.template_key);
    if (!EMAIL_TEMPLATE_DEFAULTS[key]) continue;

    merged[key] = {
      ...EMAIL_TEMPLATE_DEFAULTS[key],
      templateName: cleanText(row.template_name) || EMAIL_TEMPLATE_DEFAULTS[key].templateName,
      subject: cleanText(row.subject) || EMAIL_TEMPLATE_DEFAULTS[key].subject,
      textBody: cleanText(row.text_body) || EMAIL_TEMPLATE_DEFAULTS[key].textBody,
      htmlBody: cleanText(row.html_body) || EMAIL_TEMPLATE_DEFAULTS[key].htmlBody,
      updatedAt: row.updated_at || null,
      isCustom: Boolean(cleanText(row.subject) || cleanText(row.text_body) || cleanText(row.html_body)),
    };
  }

  return merged;
}

export async function saveEmailTemplates(templates = {}) {
  await ensureEmailTemplatesTable();

  for (const [templateKey, fallback] of Object.entries(EMAIL_TEMPLATE_DEFAULTS)) {
    const incoming = templates?.[templateKey] || {};
    const templateName = cleanText(incoming.templateName) || fallback.templateName;
    const subject = cleanText(incoming.subject) || fallback.subject;
    const textBody = cleanText(incoming.textBody) || fallback.textBody;
    const htmlBody = cleanText(incoming.htmlBody) || fallback.htmlBody;

    await pool.query(
      `
        INSERT INTO netst_email_template (
          template_key,
          template_name,
          subject,
          text_body,
          html_body,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (template_key)
        DO UPDATE SET
          template_name = EXCLUDED.template_name,
          subject = EXCLUDED.subject,
          text_body = EXCLUDED.text_body,
          html_body = EXCLUDED.html_body,
          updated_at = NOW()
      `,
      [templateKey, templateName, subject, textBody, htmlBody]
    );
  }
}

function renderTemplateString(template, variables = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function resolveEmailTemplate(templateKey, variables = {}) {
  const templates = await getEmailTemplateMap();
  const selected = templates[templateKey] || EMAIL_TEMPLATE_DEFAULTS[templateKey];

  if (!selected) {
    return {
      subject: "",
      text: "",
      html: "",
    };
  }

  return {
    subject: renderTemplateString(selected.subject, variables),
    text: renderTemplateString(selected.textBody, variables),
    html: renderTemplateString(selected.htmlBody, variables),
  };
}
