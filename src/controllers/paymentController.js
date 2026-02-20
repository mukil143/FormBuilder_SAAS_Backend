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
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Get or Create Razorpay Customer ID
    // We reuse the ID if it exists to keep billing history clean.
    let customerId = user.razorpayCustomerId;

    if (customerId === null || customerId === undefined || customerId === "") {
      const customer = await razorpay.customers.create({
        name: user.name,
        email: user.email,
        fail_existing: 0, // If email exists in Razorpay, return that customer
      });
      customerId = customer.id;
    }

    




      // Save it to our DB for next time
       await prisma.user.update({
        where: { userId },
        data: { razorpayCustomerId: customerId },
      });




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





