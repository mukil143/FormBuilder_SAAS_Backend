import express from "express";
import { protect } from "../Middleware/authMiddleware.js"; // You made this earlier
import { createSubscription } from "../controllers/paymentController.js"; // You made this earlier
import { getSubscription, cancelSubscription } from "../controllers/subscriptionController.js";

const router = express.Router();



// --- SUBSCRIPTION ROUTES ---
router.post("/subscription/create", [protect], createSubscription); // The Payment Button


router.get("/subscription", [protect], getSubscription);

// "My Plan" page
router.post("/subscription/cancel", [protect], cancelSubscription); // "Cancel" button

export default router;
