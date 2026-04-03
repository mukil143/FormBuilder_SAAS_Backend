import { prisma } from "../config/db.js"; // or ../config/db.js
import { razorpay } from "../config/razorpay.js";

// ---------------------------------------------------------
// 1. GET SUBSCRIPTION DETAILS
// GET /api/dashboard/subscription
// ---------------------------------------------------------
export const getSubscription = async (req, res) => {
  try {
    const { userId } = req.user;

    // 🔥 Get active subscription + plan
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      include: {
        planDetails: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // ✅ If no subscription → FREE plan
    if (!subscription) {
      const freePlan = await prisma.plan.findFirst({
        where: {
          planType: "FREE",
          isActive: true,
        },
      });

      return res.json({
        success: true,
        data: {
          plan: freePlan?.planType || "FREE",
          name: freePlan?.name || "Free Plan",
          price: freePlan?.amount || 0,
          status: "active",
          renewalDate: null,
        },
      });
    }

    const plan = subscription.planDetails;

    return res.json({
      success: true,
      data: {
        plan: plan.planType, // ✅ from Plan table
        name: plan.name,
        price: plan.amount,
        status: subscription.status,
        renewalDate: subscription.currentPeriodEnd,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription",
    });
  }
};

// ---------------------------------------------------------
// 2. CANCEL SUBSCRIPTION
// POST /api/dashboard/subscription/cancel
// ---------------------------------------------------------
export const cancelSubscription = async (req, res) => {
  try {
    const { userId } = req.user;

    // 🔥 Find active subscription
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
    });

    if (!sub) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found",
      });
    }

    // 🔥 Call Razorpay cancel
    await razorpay.subscriptions.cancel(
      sub.razorpaySubscriptionId,
      false, // immediate cancel
    );

    // ❗ DO NOT update DB here (correct)
    // webhook will handle it

    return res.json({
      success: true,
      message:
        "Subscription cancellation initiated. You will be downgraded shortly.",
    });
  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
    });
  }
};
