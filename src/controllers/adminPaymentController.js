// src/controllers/adminPaymentController.js
import { prisma } from "../config/db.js";
import { razorpay } from "../config/razorpay.js";
import { encrypt } from "../utils/encryption.js";
import { getRazorpayInstance } from "../utils/razorpayInstance.js";
import Razorpay from "razorpay";

const periodOptions = ["daily", "weekly", "monthly", "yearly"];

const checkValidPeriod = (period) => {
  return periodOptions.includes(period.toLowerCase());
};

// --- 1. SAVE PLATFORM KEYS ---
/**
 * path: POST /api/admin/payment/keys
 */
export const savePlatformRazorpayKeys = async (req, res) => {
  try {
    const { keyId, keySecret, webHookSecret } = req.body;

    if (!keyId || !keySecret) {
      return res
        .status(400)
        .json({ success: false, message: "Key ID and Secret required" });
    }

    // --- 🚨 NEW: VERIFICATION STEP 🚨 ---
    try {
      // 1. Initialize a temporary instance with the raw, unencrypted keys
      const testRazorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      // 2. Make a safe, read-only request (fetching 1 customer)
      // If the keys are invalid, this will immediately throw an error
      await testRazorpay.customers.all({ count: 1 });
    } catch (verificationError) {
      console.error("Razorpay Verification Failed:", verificationError);
      return res.status(401).json({
        success: false,
        message:
          "Invalid Razorpay credentials. Please check your Key ID and Secret.",
      });
    }

    // Encrypt the secret before saving
    const encryptedSecret = encrypt(keySecret);

    const webHookSecretKey = encrypt(webHookSecret);

    // We use findFirst. If it exists, update it. If not, create it.
    const existingSetting = await prisma.platformSetting.findFirst();

    if (existingSetting) {
      await prisma.platformSetting.update({
        where: { id: existingSetting.id },
        data: {
          razorpayKeyId: keyId,
          razorpayKeySecret: encryptedSecret,
          razorpayWebhookSecret: webHookSecretKey, // Encrypt webhook secret as well
        },
      });
    } else {
      await prisma.platformSetting.create({
        data: {
          razorpayKeyId: keyId,
          razorpayKeySecret: encryptedSecret,
          razorpayWebhookSecret: webHookSecretKey, // Encrypt webhook secret as well
        },
      });
    }

    res.json({
      success: true,
      message: "Platform Payment Settings updated successfully.",
    });
  } catch (error) {
    console.error("Save Keys Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to save payment settings." });
  }
};

// --- 2. CREATE A SAAS PLAN ---
/**
 * path: POST /api/admin/payment/plans
 */
export const createPlatformPlan = async (req, res) => {
  try {
    const {
      planType,
      name,
      description,
      monthlyResponseLimit,
      dailyResponseLimit,
      apiKeyLimit,
      userLimit,
      activeFormLimit,
      interval,
      themeAccess,
      amount,
      period,
    } = req.body.planDetails;

    if (!planType || !name || !period) {
      return res.status(400).json({
        success: false,
        message: "planType, name, and period are required",
      });
    }

    const normalizedPeriod = period.toLowerCase();

    if (!checkValidPeriod(normalizedPeriod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period. Valid options: ${periodOptions.join(", ")}`,
      });
    }

    // 🔥 Prevent duplicate plan (PRO monthly, etc.)
    const existingPlan = await prisma.plan.findFirst({
      where: {
        planType,
        period: normalizedPeriod,
      },
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: `${planType} ${normalizedPeriod} plan already exists`,
      });
    }

    let razorpayPlanId = null;
    const razorpay = await getRazorpayInstance();

    // 🔥 Only create Razorpay plan for PAID plans
    if (planType !== "FREE") {
      if (!amount) {
        return res.status(400).json({
          success: false,
          message: "Amount is required for paid plans",
        });
      }

      const rzpPlan = await razorpay.plans.create({
        period: normalizedPeriod,
        interval: Number(interval) || 1,
        item: {
          name,
          description,
          amount: amount * 100, // paise
          currency: "INR",
        },
      });

      razorpayPlanId = rzpPlan.id;
    }

    // 🔥 Create plan in DB
    const newPlan = await prisma.plan.create({
      data: {
        planType,
        razorpayPlanId, // null for FREE
        name,
        description,
        amount: planType === "FREE" ? 0 : amount * 100,
        period: normalizedPeriod,
        interval: Number(interval) || 1,
        isActive: true,

        // ✅ Correct naming
        monthlyResponseLimit: monthlyResponseLimit || 0,
        dailyResponseLimit: dailyResponseLimit || 0,
        apiKeyLimit: apiKeyLimit || 0,
        userLimit: userLimit || 0,
        activeFormLimit: activeFormLimit || 0,
        themeAccess: themeAccess || false,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan: newPlan,
    });
  } catch (error) {
    console.error("Create Plan Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create plan",
    });
  }
};

// --- 3. UPDATE A SAAS PLAN ---
/**
 * path: PUT /api/admin/payment/plans/:planId
 */
export const updatePlatformPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const {
      name,
      description,
      interval,
      monthlyResponseLimit,
      dailyResponseLimit,
      apiKeyLimit,
      userLimit,
      activeFormLimit,
      themeAccess,
      amount,
      period,
    } = req.body.planDetails;

    if (!planId || !name || !period) {
      return res.status(400).json({
        success: false,
        message: "planId, name, and period are required",
      });
    }

    const normalizedPeriod = period.toLowerCase();

    if (!checkValidPeriod(normalizedPeriod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid period`,
      });
    }

    const existingPlan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    let razorpayPlanId = existingPlan.razorpayPlanId;
    const razorpay = await getRazorpayInstance();

    // 🚨 If pricing/period changed → create new Razorpay plan
    const pricingChanged =
      existingPlan.amount !== amount * 100 ||
      existingPlan.period !== normalizedPeriod ||
      existingPlan.interval !== Number(interval || 1);

    if (existingPlan.planType !== "FREE" && pricingChanged) {
      const rzpPlan = await razorpay.plans.create({
        period: normalizedPeriod,
        interval: Number(interval) || 1,
        item: {
          name,
          description,
          amount: amount * 100,
          currency: "INR",
        },
      });

      razorpayPlanId = rzpPlan.id;
    }

    // 🔥 Update DB
    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        name,
        description,
        amount: existingPlan.planType === "FREE" ? 0 : amount * 100,
        period: normalizedPeriod,
        interval: Number(interval) || 1,
        razorpayPlanId,

        // ✅ correct fields
        monthlyResponseLimit:
          monthlyResponseLimit ?? existingPlan.monthlyResponseLimit,
        dailyResponseLimit:
          dailyResponseLimit ?? existingPlan.dailyResponseLimit,
        apiKeyLimit: apiKeyLimit ?? existingPlan.apiKeyLimit,
        userLimit: userLimit ?? existingPlan.userLimit,
        activeFormLimit: activeFormLimit ?? existingPlan.activeFormLimit,
        themeAccess: themeAccess ?? existingPlan.themeAccess,
      },
    });

    return res.json({
      success: true,
      message: pricingChanged
        ? "Plan updated (new pricing will apply to new subscriptions)"
        : "Plan updated successfully",
      plan: updatedPlan,
    });
  } catch (error) {
    console.error("Update Plan Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update plan.",
    });
  }
};

// --- 4. DELETE A SAAS PLAN ---
/**
 * path: DELETE /api/admin/payment/plans/:planId
 */
export const deletePlatformPlan = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const activeSubs = await prisma.subscription.count({
      where: {
        planId,
      },
    });

    // 🚨 If users exist → archive
    if (activeSubs > 0) {
      const updated = await prisma.plan.update({
        where: { id: planId },
        data: { isActive: false },
      });

      return res.json({
        success: true,
        message: "Plan archived (active subscribers exist)",
        plan: updated,
      });
    }

    // ✅ Safe delete
    await prisma.plan.delete({
      where: { id: planId },
    });

    return res.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete Plan Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * activate the archived plan if the admin wants to activate the plan again.
 * path: POST /api/admin/payment/plans/activate
 */
export const activatePlatformPlan = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const updated = await prisma.plan.update({
      where: { id: planId },
      data: { isActive: true },
    });

    return res.json({
      success: true,
      message: "Plan activated successfully",
      plan: updated,
    });
  } catch (error) {
    console.error("Activate Plan Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


