import { prisma } from "../config/db.js";
import { getRazorpayInstance } from "../utils/razorpayInstance.js";

// export const createSubscription = async (req, res) => {
//   try {
//     console.log("Create Subscription Request Body:", req.body);
//     const { userId } = req.user;
//     const { planType, planId } = req.body; // Expecting "PRO" or "BUSINESS"

//     // 1. Validation
//     if (!["PRO", "BUSINESS"].includes(planType)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid plan type" });
//     }

//     console.log(`Creating ${planType} subscription for user ${userId}`);

//     const user = await prisma.user.findUnique({ where: { userId } });

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     let customerId = user.razorpayCustomerId;

//     if (!customerId) {
//       try {
//         const customer = await razorpay.customers.create({
//           name: user.name,
//           email: user.email,
//           contact: user.phone || "9999999999", // ✅ IMPORTANT
//           fail_existing: 0,
//         });

//         customerId = customer.id;

//         await prisma.user.update({
//           where: { userId },
//           data: { razorpayCustomerId: customerId },
//         });
//       } catch (error) {
//         // 🔥 Handle "already exists" manually
//         if (error?.error?.description?.includes("already exists")) {
//           console.log("⚠️ Customer exists in Razorpay, fetching manually...");

//           // Fetch customers list
//           const customers = await razorpay.customers.all({ count: 100 });

//           const existing = customers.items.find((c) => c.email === user.email);

//           if (!existing) {
//             throw new Error("Customer exists but not found in fetch");
//           }

//           customerId = existing.id;

//           // Save to DB again
//           await prisma.user.update({
//             where: { userId },
//             data: { razorpayCustomerId: customerId },
//           });
//         } else {
//           throw error;
//         }
//       }
//     }

//     // 3. Create the Subscription on Razorpay
//     // This tells Razorpay: "Start a monthly charge for this customer on this plan"
//     const subscription = await razorpay.subscriptions.create({
//       plan_id: PLAN_IDS[planType], // Use the PRO plan for testing. Switch to BUSINESS in production.,
//       customer_id: customerId,
//       total_count: 12, // Max billing cycles (e.g. 10 years). Required by Razorpay.
//       quantity: 1,
//       notes: {
//         userId: userId, // Helper for webhooks later
//         planType: planType,
//       },
//     });

//     // 4. Send the Subscription ID to Frontend
//     // The frontend will use this ID to open the Razorpay Payment Popup
//     res.status(201).json({
//       success: true,
//       subscriptionId: subscription.id,
//       keyId: process.env.RAZORPAY_KEY_ID, // Frontend needs this to open the popup
//     });
//   } catch (error) {
//     console.error("Razorpay Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create subscription",
//       error: error,
//     });
//   }
// };
// export const createSubscription = async (req, res) => {
//   try {
//     const { planId } = req.body;
//     const userId = req.user.userId;

//     if (!planId) {
//       return res.status(400).json({
//         success: false,
//         message: "planId is required",
//       });
//     }

//     // 🔥 STEP 1 — Get plan from DB
//     const plan = await prisma.plan.findUnique({
//       where: { id: planId },
//     });

//     if (!plan || !plan.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or inactive plan",
//       });
//     }

//     // 🔥 STEP 2 — Get user
//     const user = await prisma.user.findUnique({
//       where: { userId },
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const razorpay = await getRazorpayInstance();

//     // 🔥 STEP 3 — Get or create customer
//     let customerId = user.razorpayCustomerId;

//     if (!customerId) {
//       const customer = await razorpay.customers.create({
//         name: user.name,
//         email: user.email,
//         contact: user.phone || "9999999999",
//         fail_existing: 0,
//       });

//       customerId = customer.id;

//       await prisma.user.update({
//         where: { userId },
//         data: { razorpayCustomerId: customerId },
//       });
//     }

//     // 🔥 STEP 4 — Create subscription using razorpayPlanId
//     const subscription = await razorpay.subscriptions.create({
//       plan_id: plan.razorpayPlanId, // ✅ KEY FIX
//       customer_id: customerId,
//       total_count: 12,
//       quantity: 1,
//       notes: {
//         userId,
//         planId: plan.id, // 🔥 VERY IMPORTANT (for webhook)
//       },
//     });

//     // 🔥 STEP 5 — Save initial subscription (optional)
//     await prisma.subscription.create({
//       data: {
//         userId,
//         razorpaySubscriptionId: subscription.id,
//         planId: plan.id, // ✅ link your plan
//         status: "created",
//         currentPeriodEnd: new Date(),
//       },
//     });

//     res.json({
//       success: true,
//       subscription,
//     });
//   } catch (error) {
//     console.error("Create Subscription Error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// export const createSubscription = async (req, res) => {
//   try {
//     const { planId } = req.body;
//     const userId = req.user.userId;

//     if (!planId) {
//       return res.status(400).json({
//         success: false,
//         message: "planId is required",
//       });
//     }

//     // 🔥 1. Get plan
//     const plan = await prisma.plan.findUnique({
//       where: { id: planId },
//     });

//     if (!plan || !plan.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or inactive plan",
//       });
//     }

//     // 🔥 2. Get user
//     const user = await prisma.user.findUnique({
//       where: { userId },
//     });

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     const razorpay = await getRazorpayInstance();

//     // =========================================================
//     // 🔥 3. CLEAN OLD PENDING SUBSCRIPTIONS (IMPORTANT)
//     // =========================================================

//     const pendingSubs = await prisma.subscription.findMany({
//       where: {
//         userId,
//         status: "created",
//       },
//     });

//     for (const sub of pendingSubs) {
//       try {
//         const rzpSub = await razorpay.subscriptions.fetch(
//           sub.razorpaySubscriptionId,
//         );

//         // Only cancel if still pending in Razorpay
//         if (rzpSub.status === "created") {
//           await razorpay.subscriptions.cancel(
//             sub.razorpaySubscriptionId,
//             false,
//           );

//           console.log(
//             "🗑️ Cancelled pending Razorpay sub:",
//             sub.razorpaySubscriptionId,
//           );
//         }
//       } catch (err) {
//         console.log(
//           "⚠️ Skip cancel pending:",
//           err?.error?.description || err.message,
//         );
//       }
//     }

//     // Delete all pending from DB
//     await prisma.subscription.deleteMany({
//       where: {
//         userId,
//         status: "created",
//       },
//     });

//     // =========================================================
//     // 🔥 4. GET / CREATE CUSTOMER
//     // =========================================================

//     let customerId = user.razorpayCustomerId;

//     if (!customerId) {
//       const customer = await razorpay.customers.create({
//         name: user.name,
//         email: user.email,
//         contact: user.phone || "9999999999",
//         fail_existing: 0,
//       });

//       customerId = customer.id;

//       await prisma.user.update({
//         where: { userId },
//         data: { razorpayCustomerId: customerId },
//       });
//     }

//     // =========================================================
//     // 🔥 5. CREATE NEW SUBSCRIPTION
//     // =========================================================

//     const subscription = await razorpay.subscriptions.create({
//       plan_id: plan.razorpayPlanId,
//       customer_id: customerId,
//       total_count: 12,
//       quantity: 1,
//       notes: {
//         userId,
//         planId: plan.id,
//       },
//     });

//     // =========================================================
//     // 🔥 6. SAVE IN DB (CREATED STATE)
//     // =========================================================

//     await prisma.subscription.create({
//       data: {
//         userId,
//         razorpaySubscriptionId: subscription.id,
//         planId: plan.id,
//         status: "created",
//         currentPeriodEnd: new Date(),
//       },
//     });

//     // =========================================================
//     // ✅ RESPONSE
//     // =========================================================

//     return res.status(200).json({
//       success: true,
//       message: "Subscription created. Complete payment to activate.",
//       subscriptionId: subscription.id,
//     });
//   } catch (error) {
//     console.error("Create Subscription Error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create subscription",
//     });
//   }
// };

export const createSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.userId;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    // 🔥 Get plan
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        message: "Invalid or inactive plan",
      });
    }

    // 🔥 Get user
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const razorpay = await getRazorpayInstance();

    // ====================================================
    // 🔥 CLEAN OLD PENDING SUBSCRIPTIONS
    // ====================================================
    const pendingSubs = await prisma.subscription.findMany({
      where: {
        userId,
        status: "created",
      },
    });

    for (const sub of pendingSubs) {
      try {
        const rzpSub = await razorpay.subscriptions.fetch(
          sub.razorpaySubscriptionId,
        );

        if (rzpSub.status === "created") {
          await razorpay.subscriptions.cancel(
            sub.razorpaySubscriptionId,
            false,
          );
        }
      } catch (err) {
        console.log("⚠️ Skip cancel:", err?.error?.description);
      }
    }

    await prisma.subscription.deleteMany({
      where: {
        userId,
        status: "created",
      },
    });

    // ====================================================
    // 🔥 GET / CREATE CUSTOMER
    // ====================================================
    let customerId = user.razorpayCustomerId;

    if (!customerId) {
      const customer = await razorpay.customers.create({
        name: user.name,
        email: user.email,
        contact: "9999999999",
        fail_existing: 0,
      });

      customerId = customer.id;

      await prisma.user.update({
        where: { userId },
        data: { razorpayCustomerId: customerId },
      });
    }

    // ====================================================
    // 🔥 CREATE SUBSCRIPTION IN RAZORPAY
    // ====================================================
    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      customer_id: customerId,
      total_count: 12,
      notes: {
        userId,
        planId: plan.id,
      },
    });

    // ====================================================
    // 🔥 SAVE IN DB
    // ====================================================
    await prisma.subscription.create({
      data: {
        userId,
        razorpaySubscriptionId: subscription.id,
        planId: plan.id,
        status: "created",
        currentPeriodEnd: new Date(),
      },
    });

    const keyId  = await prisma.platformSetting.findFirst();

    return res.json({
      success: true,
      subscriptionId: subscription.id,
      keyId: keyId.razorpayKeyId, // Frontend needs this to open the popup
    });
  } catch (error) {
    console.error("Create Subscription Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
