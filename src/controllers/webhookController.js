import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { sendEmail } from "../config/resend.js";
import { decrypt } from "../utils/encryption.js";
import { getRazorpayInstance } from "../utils/razorpayInstance.js";

export const handleRazorpayWebhook = async (req, res) => {
  try {
    // =========================================================
    // 🔐 1. VERIFY SIGNATURE
    // =========================================================
    const setting = await prisma.platformSetting.findFirst();
    const secret = decrypt(setting?.razorpayWebhookSecret);

    if (!secret) {
      console.error("⚠️ Missing webhook secret");
      return res.status(500).json({ status: "missing_secret" });
    }

    const signature = req.headers["x-razorpay-signature"];

    // Use req.body directly assuming it's an express.raw buffer
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(req.body);
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      console.error("⚠️ Invalid signature");
      return res.status(400).json({ status: "invalid_signature" });
    }

    // =========================================================
    // 📦 2. PARSE BODY
    // =========================================================
    const body = JSON.parse(req.body.toString());
    const event = body.event;
    const subData = body.payload.subscription.entity;

    console.log(`🔔 Webhook Received: ${event} for Sub ID: ${subData.id}`);

    // =========================================================
    // 🛑 3. IGNORE DELETED PENDING
    // =========================================================
    const existing = await prisma.subscription.findUnique({
      where: { razorpaySubscriptionId: subData.id },
    });

    if (
      !existing &&
      event !== "subscription.charged" &&
      event !== "subscription.authenticated"
    ) {
      console.log("⚠️ Ignored webhook for unrecorded subscription.");
      return res.json({ status: "ignored" });
    }

    // =========================================================
    // 🎯 4. ROUTE EVENTS
    // =========================================================
    const handlers = {
      "subscription.authenticated": handleAuthenticated,
      "subscription.charged": handleCharged,
      "subscription.cancelled": handleCancelledOrHalted,
      "subscription.halted": handleCancelledOrHalted,
    };

    const handler = handlers[event];

    if (!handler) {
      console.log("⚠️ Ignored unhandled event:", event);
      return res.json({ status: "ignored" });
    }

    // Pass the payload to the specific handler
    const result = await handler(subData, event, existing);

    return res.json({
      status: result === "already_processed" ? "already_processed" : "ok",
    });
  } catch (error) {
    console.error("Webhook Master Error:", error);
    // Always return 200 to Razorpay so they don't keep retrying on our internal server errors
    return res.status(200).json({ status: "error_handled" });
  }
};

// =========================================================
// 🛠️ HANDLER FUNCTIONS
// =========================================================

const handleAuthenticated = async (subData, event, existing) => {
  const { id, current_end, notes } = subData;
  const userId = notes?.userId;
  const planId = notes?.planId;

  if (!userId || !planId) return "ignored";

  if (existing?.status === "active") {
    return "already_processed";
  }

  const razorpay = await getRazorpayInstance();

  // 🔥 Cancel old active subscriptions in Razorpay and DB
  const oldSubs = await prisma.subscription.findMany({
    where: {
      userId,
      status: "active",
      razorpaySubscriptionId: { not: id },
    },
  });

  for (const sub of oldSubs) {
    try {
      const rzpSub = await razorpay.subscriptions.fetch(
        sub.razorpaySubscriptionId,
      );
      if (rzpSub.status === "active") {
        await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, false);
      }
      await prisma.subscription.update({
        where: { razorpaySubscriptionId: sub.razorpaySubscriptionId },
        data: { status: "cancelled" },
      });
    } catch (err) {
      console.log(
        "⚠️ Skip cancel old sub:",
        err?.error?.description || err.message,
      );
    }
  }

  // 🔥 Activate new subscription
  await prisma.subscription.upsert({
    where: { razorpaySubscriptionId: id },
    update: {
      status: "active",
      currentPeriodEnd: new Date(current_end * 1000),
      planId,
    },
    create: {
      userId,
      razorpaySubscriptionId: id,
      planId,
      status: "active",
      currentPeriodEnd: new Date(current_end * 1000),
    },
  });

  // Optional: Send Welcome Email
  const user = await prisma.user.findUnique({ where: { userId } });
  if (user) {
    await sendEmail({
      to: user.email,
      subject: "Subscription Activated",
      html: `<p>Your new plan is now active! Thank you for subscribing.</p>`,
    });
  }

  console.log("✅ Subscription authenticated and activated.");
  return "ok";
};

const handleCharged = async (subData) => {
  const { id, current_end, notes } = subData;
  const userId = notes?.userId;

  // 🔥 Transaction: Update subscription AND reset user form limits
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { razorpaySubscriptionId: id },
      data: {
        status: "active",
        currentPeriodEnd: new Date(current_end * 1000),
      },
    });

    if (userId) {
      await tx.user.update({
        where: { userId },
        data: {
          monthlyResponseCount: 0, // 🚨 Reset usage limits for the new billing month!
          // dailyResponseCount: 0 // Reset this via a daily cron job instead of here
        },
      });
    }
  });

  console.log(
    `✅ Subscription ${id} successfully charged. Usage limits reset.`,
  );
  return "ok";
};

const handleCancelledOrHalted = async (subData, event) => {
  const { id, notes } = subData;
  const userId = notes?.userId;
  const status = event === "subscription.cancelled" ? "cancelled" : "halted";

  await prisma.subscription.updateMany({
    where: { razorpaySubscriptionId: id },
    data: { status },
  });

  // Notify the user their plan failed or was cancelled
  if (userId) {
    const user = await prisma.user.findUnique({ where: { userId } });
    if (user) {
      await sendEmail({
        to: user.email,
        subject:
          status === "cancelled" ? "Subscription Cancelled" : "Payment Failed",
        html: `<p>Your subscription has been ${status}. Please update your billing details to maintain access to premium features.</p>`,
      });
    }
  }

  console.log(`⚠️ Subscription ${id} marked as ${status}`);
  return "ok";
};
