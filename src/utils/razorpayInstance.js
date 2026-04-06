import Razorpay from "razorpay";
import { prisma } from "../config/db.js";
import { decrypt } from "./encryption.js"; // Using the encryption utility we discussed earlier

export const getRazorpayInstance = async () => {
  // Fetch the first (and only) row from PlatformSetting
  const settings = await prisma.platformSetting.findFirst();

  if (!settings || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
    throw new Error("Razorpay credentials not configured by Admin.");
  }

  const razorpaysecret = decrypt(settings.razorpayKeySecret);

  if (!razorpaysecret) {
    throw new Error("Failed to decrypt Razorpay secret key.");
  }
  return new Razorpay({
    key_id: settings.razorpayKeyId,
    key_secret: razorpaysecret,
  });
};
