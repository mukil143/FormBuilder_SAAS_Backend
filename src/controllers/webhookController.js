import crypto from "node:crypto";
import { prisma } from "../config/db.js"; // Check if this path is correct for you
import { PLAN_IDS } from "../config/razorpay.js";
import { sendEmail } from "../config/resend.js";
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
  const userId = notes.userId;
  const planType = getPlanTypeFromId(plan_id);

  // ✅ Idempotency
  const existing = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId: id },
  });

  if (existing?.status === "active") {
    console.log("Already processed authenticated");
    return "already_processed";
  }

  // ✅ Deactivate old subscriptions (DB only)
  await prisma.subscription.updateMany({
    where: {
      userId,
      status: "active",
      razorpaySubscriptionId: { not: id },
    },
    data: {
      status: "cancelled",
      isActive: false,
    },
  });

  // ✅ Upsert new subscription
  await prisma.subscription.upsert({
    where: { razorpaySubscriptionId: id },
    update: {
      status: "active",
      currentPeriodEnd: new Date(current_end * 1000),
    },
    create: {
      userId,
      razorpaySubscriptionId: id,
      plan: planType,
      status: "active",
      currentPeriodEnd: new Date(current_end * 1000),
      isActive: true,
    },
  });

  // ✅ Update user plan
  await prisma.user.update({
    where: { userId },
    data: { plan: planType },
  });

  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) throw new Error("User not found");
  // ✅ Email
  try {
    const mailOptions = {
      to: user.email,
      subject: "Subscription Upgraded",
      html: `<p>Your subscription has been upgraded to ${planType}</p>`,
    };
    const res = await sendEmail(mailOptions);
    console.log("Email sent: " + res);
  } catch (error) {
    console.error("Email Error:", error);
  }

  console.log(`✅ User ${userId} upgraded to ${planType}`);
  return "ok";
};

const handleCharged = async (subData, event) => {
  const { id, plan_id, current_end, notes } = subData;
  const userId = notes.userId;

  try {
    const existing = await prisma.subscription.findUnique({
      where: { razorpaySubscriptionId: id },
    });

    if (existing?.status === "active") {
      console.log("Already processed");
      return "already_processed";
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
        plan: getPlanTypeFromId(plan_id),
        status: "active",
        currentPeriodEnd: new Date(current_end * 1000),
        isActive: true,
      },
    });

    await prisma.user.update({
      where: { userId },
      data: { monthlyResponseCount: 0 },
    });

    const user = await prisma.user.findUnique({ where: { userId } });

    if (user) {
      try {
        const mailOptions = {
          to: user.email,
          subject: "Subscription Renewed",
          html: `<p>Your subscription has been renewed successfully.</p>`,
        };
        const res = await sendEmail(mailOptions);
        console.log("Email sent: " + res);
      } catch (error) {
        console.error("Email Error:", error);
      }
    }

    console.log(`✅ Subscription renewed for ${id}`);
    return "ok";
  } catch (error) {
    console.error("DB Error:", error);
    return "error";
  }
};

const handleCancelledOrHalted = async (subData, event) => {
  try {
    const { id, notes } = subData;
    const userId = notes.userId;

    const status = event === "subscription.cancelled" ? "cancelled" : "halted";

    console.log(
      event === "subscription.halted"
        ? `⚠️ Payment failed for ${userId}`
        : `❌ Subscription cancelled for ${userId}`,
    );

    // ✅ Idempotency
    const existing = await prisma.subscription.findUnique({
      where: { razorpaySubscriptionId: id },
    });

    if (existing?.status === status) {
      console.log("Already processed");
      return "already_processed";
    }

    // ✅ Correct status update
    await prisma.subscription.upsert({
      where: { razorpaySubscriptionId: id },
      update: {
        status, // ✅ FIXED
        isActive: false,
      },
      create: {
        userId,
        razorpaySubscriptionId: id,
        status, // ✅ FIXED
        currentPeriodEnd: new Date(),
        isActive: false,
      },
    });

    // ✅ Determine user plan from DB
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    await prisma.user.update({
      where: { userId },
      data: {
        plan: activeSub ? activeSub.plan : "FREE",
      },
    });

    if (activeSub) {
      console.log(`⚠️ Active plan exists (${activeSub.plan})`);
    } else {
      console.log("⬇️ User downgraded to FREE");
    }

    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) throw new Error("User not found");
    // ✅ Email
    try {
      const mailOptions = {
        to: user.email,
        subject:
          status === "cancelled" ? "Subscription Cancelled" : "Payment Failed",
        html: `<p>Your subscription has been ${status === "cancelled" ? "cancelled" : "halted due to payment failure"}.</p>`,
      };

      await sendEmail(mailOptions);
      console.log(`✅ Subscription ${status} for ${userId}`);
    } catch (error) {
      console.error("Email Error:", error);
    }

    return "ok";
  } catch (error) {
    console.error("Cancel/Halt Error:", error);
    return "error";
  }
};
