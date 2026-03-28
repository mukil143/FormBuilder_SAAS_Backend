import { prisma } from "../config/db.js";
import { razorpay, PLAN_IDS } from "../config/razorpay.js";

export const createSubscription = async (req, res) => {
  try {
    console.log("Create Subscription Request Body:", req.body);
    const { userId } = req.user;
    const { planType } = req.body; // Expecting "PRO" or "BUSINESS"

    // 1. Validation
    if (!["PRO", "BUSINESS"].includes(planType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid plan type" });
    }

    console.log(`Creating ${planType} subscription for user ${userId}`);

    const user = await prisma.user.findUnique({ where: { userId } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    

    let customerId = user.razorpayCustomerId;

    if (!customerId) {
      try {
        const customer = await razorpay.customers.create({
          name: user.name,
          email: user.email,
          contact: user.phone || "9999999999", // ✅ IMPORTANT
          fail_existing: 0,
        });

        customerId = customer.id;

        await prisma.user.update({
          where: { userId },
          data: { razorpayCustomerId: customerId },
        });
      } catch (error) {
        // 🔥 Handle "already exists" manually
        if (error?.error?.description?.includes("already exists")) {
          console.log("⚠️ Customer exists in Razorpay, fetching manually...");

          // Fetch customers list
          const customers = await razorpay.customers.all({ count: 100 });

          const existing = customers.items.find((c) => c.email === user.email);

          if (!existing) {
            throw new Error("Customer exists but not found in fetch");
          }

          customerId = existing.id;

          // Save to DB again
          await prisma.user.update({
            where: { userId },
            data: { razorpayCustomerId: customerId },
          });
        } else {
          throw error;
        }
      }
    }

    // 3. Create the Subscription on Razorpay
    // This tells Razorpay: "Start a monthly charge for this customer on this plan"
    const subscription = await razorpay.subscriptions.create({
      plan_id: PLAN_IDS[planType], // Use the PRO plan for testing. Switch to BUSINESS in production.,
      customer_id: customerId,
      total_count: 12, // Max billing cycles (e.g. 10 years). Required by Razorpay.
      quantity: 1,
      notes: {
        userId: userId, // Helper for webhooks later
        planType: planType,
      },
    });

    // 4. Send the Subscription ID to Frontend
    // The frontend will use this ID to open the Razorpay Payment Popup
    res.status(201).json({
      success: true,
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID, // Frontend needs this to open the popup
    });
  } catch (error) {
    console.error("Razorpay Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription",
      error: error,
    });
  }
};
