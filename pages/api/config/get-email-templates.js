import { getEmailTemplateMap } from "../../../lib/email-templates";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const templates = await getEmailTemplateMap();
    return res.status(200).json({ templates });
  } catch (error) {
    console.error("get-email-templates error:", error);
    return res.status(500).json({ message: "Failed to load email templates" });
  }
}
