
import dotenv from "dotenv";
dotenv.config();
import Razorpay from "razorpay";




export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



// Get these IDs from your Razorpay Dashboard -> Subscriptions -> Plans
export const PLAN_IDS = {
  PRO: process.env.RAZORPAY_PLAN_ID_PRO,       // e.g. plan_Hj8s9s8
  BUSINESS: process.env.RAZORPAY_PLAN_ID_BUSINESS // e.g. plan_Ak2k3d1
};
