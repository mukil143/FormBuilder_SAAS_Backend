import crypto from "node:crypto";
import { prisma } from "../config/db.js"; // Check if this path is correct for you
import { PLAN_IDS } from "../config/razorpay.js";

const getPlanTypeFromId = (razorpayPlanId) => {
  const planKey = Object.keys(PLAN_IDS).find(
    (key) => PLAN_IDS[key] === razorpayPlanId,
  );
  return planKey || "FREE";
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    // 1. SECURITY: Verify Signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    // 🚨 FIX 1: Pass the raw Buffer directly. Do NOT use JSON.stringify().
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(req.body);
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      console.error("⚠️ Invalid Webhook Signature");
      return res.status(400).json({ status: "invalid_signature" });
    }

    // 🚨 FIX 2: Manually parse the Buffer into JSON now that it's verified
    const body = JSON.parse(req.body.toString());

    // Use 'body' instead of 'req.body' for the rest of the logic
    const event = body.event;
    const payload = body.payload;

    console.log(`🔔 Webhook Received: ${event}`);

    switch (event) {
      case "subscription.authenticated": {
        const subData = payload.subscription.entity;
        const { id, plan_id, current_end, notes } = subData;
        const userId = notes.userId;

        const planType = getPlanTypeFromId(plan_id);

        // 🚨 THE FIX: FIND AND CANCEL ANY OLD ACTIVE SUBSCRIPTIONS FIRST
        const oldActiveSubs = await prisma.subscription.findMany({
          where: {
            userId: userId,
            status: "active",
            razorpaySubscriptionId: { not: id }, // Exclude the new one they just paid for
          },
        });

        //if they have an old active subscription, cancel it to prevent double billing
        for (const oldSub of oldActiveSubs) {
          try {
            // Tell Razorpay to stop charging the old plan
            await razorpay.subscriptions.cancel(
              oldSub.razorpaySubscriptionId,
              false,
            );

            // Mark as cancelled in our DB
            await prisma.subscription.update({
              where: { razorpaySubscriptionId: oldSub.razorpaySubscriptionId },
              data: { status: "cancelled" },
            });
            console.log(
              `♻️ Upgraded! Cancelled old plan: ${oldSub.razorpaySubscriptionId}`,
            );
          } catch (error) {
            console.error(
              "Failed to cancel old sub during upgrade:",
              error,
            );
          }
        }

        await prisma.subscription.upsert({
          where: { razorpaySubscriptionId: id },
          update: {
            status: "active",
            currentPeriodEnd: new Date(current_end * 1000),
          },
          create: {
            userId,
            razorpaySubscriptionId: id,
            razorpayPlanId: plan_id,
            plan: planType,
            status: "active",
            currentPeriodEnd: new Date(current_end * 1000),
          },
        });

        await prisma.user.update({
          where: { userId },
          data: { plan: planType },
        });

        console.log(`✅ User ${userId} upgraded to ${planType}`);
        break;
      }

      case "subscription.charged": {
        const subData = payload.subscription.entity;

        await prisma.subscription.update({
          where: { razorpaySubscriptionId: subData.id },
          data: {
            currentPeriodEnd: new Date(subData.current_end * 1000),
            status: "active",
          },
        });

        // Reset usage for the new month
        const userId = subData.notes.userId;
        await prisma.user.update({
          where: { userId },
          data: { monthlyResponseCount: 0 },
        });

        console.log(`✅ Subscription renewed for ${subData.id}`);
        break;
      }

      case "subscription.cancelled":
      case "subscription.halted": {
        const subData = payload.subscription.entity;
        const userId = subData.notes.userId;

        await prisma.subscription.update({
          where: { razorpaySubscriptionId: subData.id },
          data: { status: "cancelled" },
        });

        await prisma.user.update({
          where: { userId },
          data: { plan: "FREE" },
        });

        console.log(`❌ Subscription cancelled for ${userId}`);
        break;
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(200).json({ status: "error_handled" });
  }
};
