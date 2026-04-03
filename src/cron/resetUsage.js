import cron from "node-cron";
import { prisma } from "../config/db.js"; // Adjust path to your Prisma client

export const startCronJobs = () => {
  cron.schedule(
    "0 0 1 * *",
    async () => {
      console.log("⏳ [CRON] Starting monthly usage reset...");

      try {
        // 🔥 1. Reset ALL users (simplest + safest)
        const result = await prisma.user.updateMany({
          data: {
            monthlyResponseCount: 0,
          },
        });

        console.log(`✅ [CRON] Reset monthly usage for ${result.count} users.`);
      } catch (error) {
        console.error("❌ [CRON] Failed:", error);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    },
  );

  // cron.schedule("0 0 * * *", async () => {
  //   console.log("⏳ [CRON] Daily reset...");

  //   await prisma.user.updateMany({
  //     data: {
  //       dailyResponseCount: 0,
  //     },
  //   });

  //   console.log("✅ Daily reset done");
  // });

  console.log("🕒 Cron Jobs initialized.");
};
