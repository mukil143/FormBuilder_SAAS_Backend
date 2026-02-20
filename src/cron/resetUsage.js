import cron from "node-cron";
import { prisma } from "../config/db.js"; // Adjust path to your Prisma client

export const startCronJobs = () => {
  // The schedule string '0 0 1 * *' means:
  // Minute: 0, Hour: 0 (Midnight), Day of Month: 1, Month: Every, Day of Week: Every

  cron.schedule("0 0 1 * *", async () => {
    console.log("⏳ [CRON] Starting monthly usage reset for FREE users...");

    try {
      // Update all users who are on the FREE plan
      const result = await prisma.user.updateMany({
        where: { plan: "FREE" },
        data: { monthlyResponseCount: 0 }
      });

      console.log(`✅ [CRON] Successfully reset limits for ${result.count} FREE users.`);
    } catch (error) {
      console.error("❌ [CRON] Failed to reset monthly usage:", error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Ensures it runs at midnight IST, not UTC
  });

  console.log("🕒 Background Cron Jobs initialized.");
};
