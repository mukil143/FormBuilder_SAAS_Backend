import crypto from "node:crypto";
import { prisma } from "../config/db.js"; // Check if this path is correct for you
import { PLAN_IDS } from "../config/razorpay.js";
import { sendEmail } from "../config/resend.js";
import { decrypt } from "../utils/encryption.js";
// Import the transporter from the new file

const getPlanTypeFromId = (razorpayPlanId) => {
  const planKey = Object.keys(PLAN_IDS).find(
    (key) => PLAN_IDS[key] === razorpayPlanId,
  );
  return planKey || "FREE";
};

// This controller handles Razorpay webhooks for subscription events

export const handleRazorpayWebhook = async (req, res) => {
  try {
    // 1. SECURITY: Verify Signature
    const secret = decrypt(await prisma.platformSetting.findFirst().then((setting) => setting.razorpayWebhookSecret)
    );
    if (!secret) {
      console.error("⚠️ Missing Razorpay Webhook Secret in Platform Settings");
      return res.status(500).json({ status: "missing_secret" });
    }

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
    const subData = payload.subscription.entity;

    console.log(`🔔 Webhook Received: ${event}`);

    const handlers = {
      "subscription.authenticated": handleAuthenticated,
      "subscription.charged": handleCharged,
      "subscription.cancelled": handleCancelledOrHalted,
      "subscription.halted": handleCancelledOrHalted,
    };

    const handler = handlers[event];
    if (handler) {
      const result = await handler(subData, event);
      if (result === "already_processed") {
        return res.json({ status: "already_processed" });
      }
      return res.json({ status: "ok" });
    } else {
      console.error("⚠️ Invalid Webhook Event:", event);
      return res.status(400).json({ status: "invalid_event" });
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(200).json({ status: "error_handled" });
  }
};

const handleAuthenticated = async (subData) => {
  const { id, plan_id, current_end, notes } = subData;
  const userId = notes?.userId;

  if (!userId) throw new Error("Missing userId in notes");

  // 🔥 Get plan
  const plan = await prisma.plan.findUnique({
    where: { razorpayPlanId: plan_id },
  });

  if (!plan) {
    console.error("⚠️ Plan not found for:", plan_id);
    return "ignored";
  }

  // 🔥 Idempotency
  const existing = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: id },
  });

  if (existing?.status === "active") {
    console.log("Already processed authenticated");
    return "already_processed";
  }

  // 🔥 Transaction (VERY IMPORTANT)
  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: {
        userId,
        status: "active",
        razorpaySubscriptionId: { not: id },
      },
      data: { status: "cancelled" },
    }),

    prisma.subscription.upsert({
      where: { razorpaySubscriptionId: id },
      update: {
        status: "active",
        planId: plan.id,
        currentPeriodEnd: new Date(current_end * 1000),
      },
      create: {
        userId,
        razorpaySubscriptionId: id,
        planId: plan.id,
        status: "active",
        currentPeriodEnd: new Date(current_end * 1000),
      },
    }),
  ]);

  const user = await prisma.user.findUnique({ where: { userId } });

  if (user) {
    await sendEmail({
      to: user.email,
      subject: "Subscription Activated",
      html: `<p>Your subscription is now active (${plan.name})</p>`,
    });
  }

  console.log(`✅ User ${userId} subscribed to ${plan.name}`);
  return "ok";
};

const handleCharged = async (subData) => {
  const { id, plan_id, current_end, notes } = subData;
  const userId = notes?.userId;

  if (!userId) throw new Error("Missing userId");

  const plan = await prisma.plan.findUnique({
    where: { razorpayPlanId: plan_id },
  });

  if (!plan) {
    console.error("⚠️ Plan not found:", plan_id);
    return "ignored";
  }

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { razorpaySubscriptionId: id },
      update: {
        status: "active",
        planId: plan.id,
        currentPeriodEnd: new Date(current_end * 1000), // ✅ always update
      },
      create: {
        userId,
        razorpaySubscriptionId: id,
        planId: plan.id,
        status: "active",
        currentPeriodEnd: new Date(current_end * 1000),
      },
    }),

    prisma.user.update({
      where: { userId },
      data: {
        monthlyResponseCount: 0, // reset on renewal
        dailyResponseCount: 0,
      },
    }),
  ]);

  const user = await prisma.user.findUnique({ where: { userId } });

  if (user) {
    await sendEmail({
      to: user.email,
      subject: "Subscription Renewed",
      html: `<p>Your subscription has been renewed (${plan.name})</p>`,
    });
  }

  console.log(`✅ Subscription renewed for ${id}`);
  return "ok";
};

const handleCancelledOrHalted = async (subData, event) => {
  try {
    const { id, notes } = subData;
    const userId = notes?.userId;

    if (!userId) return "ignored";

    const status = event === "subscription.cancelled" ? "cancelled" : "halted";

    const existing = await prisma.subscription.findUnique({
      where: { razorpaySubscriptionId: id },
    });

    if (existing?.status === status) {
      console.log("Already processed");
      return "already_processed";
    }

    await prisma.subscription.updateMany({
      where: { razorpaySubscriptionId: id },
      data: { status },
    });

    const user = await prisma.user.findUnique({ where: { userId } });

    if (user) {
      await sendEmail({
        to: user.email,
        subject:
          status === "cancelled" ? "Subscription Cancelled" : "Payment Failed",
        html: `<p>Your subscription has been ${status}</p>`,
      });
    }

    console.log(`✅ Subscription ${status} for ${userId}`);
    return "ok";
  } catch (error) {
    console.error("Cancel/Halt Error:", error);
    return "error";
  }
};
