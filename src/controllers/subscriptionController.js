import { prisma } from "../config/db.js"; // or ../config/db.js
import { razorpay } from "../config/razorpay.js";

// ---------------------------------------------------------
// 1. GET SUBSCRIPTION DETAILS
// GET /api/dashboard/subscription
// ---------------------------------------------------------
export const getSubscription = async (req, res) => {
  try {
    const { userId } = req.user;

    // Fetch User + their latest active subscription
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        subscriptions: {
          where: { status: "active" }, // We only care about the active one
          take: 1,
          orderBy: { createdAt: "desc" }
        }
      }
    });

    // If no active sub found, they are on FREE
    const activeSub = user.subscriptions[0]; // This will be undefined if no active subscription exists

    if (!activeSub) {
      return res.json({
        success: true,
        data: {
          plan: "FREE",
          status: "active",
          price: 0,
          renewalDate: null
        }
      });
    }

    // Return the details for the frontend UI
    res.json({
      success: true,
      data: {
        plan: activeSub.plan, // "PRO" or "BUSINESS"
        status: activeSub.status,
        renewalDate: activeSub.currentPeriodEnd,
        razorpaySubscriptionId: activeSub.razorpaySubscriptionId
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch subscription" });
  }
};

// ---------------------------------------------------------
// 2. CANCEL SUBSCRIPTION
// POST /api/dashboard/subscription/cancel
// ---------------------------------------------------------
export const cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.user;

    // 1. Find the active subscription first
    const sub = await prisma.subscription.findFirst({
      where: { userId, status: "active" }
    });

    if (!sub) {
      return res.status(400).json({ success: false, message: "No active subscription found" });
    }

    // 2. Call Razorpay API to cancel it
    // The 'false' argument means "Cancel Immediately" (stops billing now).
    await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, false);

    // 3. IMPORTANT: We don't update the DB here!
    // Why? Because Razorpay will trigger your WEBHOOK ('subscription.cancelled').
    // Your webhook logic will handle the DB update and downgrade the user.

    res.json({
      success: true,
      message: "Subscription cancellation initiated. You will be downgraded shortly."
    });

  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel subscription" });
  }
};
