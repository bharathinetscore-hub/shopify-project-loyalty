const {
  awardScheduledProfilePoints,
  getLoyaltyAwardsSchedulerStatus,
} = require("../../../lib/loyalty-awards-scheduler");

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const shouldForceRun =
      req.method === "POST" ||
      String(req.query.force || "").trim().toLowerCase() === "true";

    if (shouldForceRun) {
      await awardScheduledProfilePoints({ force: true });
    }

    return res.status(200).json({
      success: true,
      forced: shouldForceRun,
      status: getLoyaltyAwardsSchedulerStatus(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to inspect scheduler",
      details: error?.message || "Unknown error",
    });
  }
}
