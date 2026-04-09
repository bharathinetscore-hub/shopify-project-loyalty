import { saveEmailTemplates } from "../../../lib/email-templates";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await saveEmailTemplates(req.body?.templates || {});
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("save-email-templates error:", error);
    return res.status(500).json({ success: false, message: "Failed to save email templates" });
  }
}
