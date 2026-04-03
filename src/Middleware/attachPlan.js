// middleware/attachPlan.js

import { prisma } from "../config/db.js";

export const attachPlan = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 🔥 Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
      },
      include: {
        planDetails: true,
      },
    });

    let plan;

    if (subscription) {
      plan = subscription.planDetails;
    } else {
      // 🔥 Fallback to FREE plan
      plan = await prisma.plan.findFirst({
        where: {
          planType: "FREE",
          isActive: true,
        },
      });

      if (!plan) {
        return res.status(500).json({
          success: false,
          message: "Free plan not configured",
        });
      }
    }

    // attach
    req.subscription = subscription || null;
    req.plan = plan;

    next();
  } catch (error) {
    console.error("Attach Plan Error:", error);
    res.status(500).json({ success: false });
  }
};
