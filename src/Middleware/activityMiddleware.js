import { prisma } from "../config/db.js";

export const trackActivity = async (req, res, next) => {
  // Only track if user is logged in
  if (req.user && req.user.userId) {
    // We use .catch() to ensure this never blocks the main request
    // "Fire and Forget" - we don't await this because we don't want to slow down the API
    prisma.user.update({
      where: { userId: req.user.userId },
      data: { lastActiveAt: new Date() }
    }).catch(err => {
      console.error("Failed to update activity status:", err.message);
    });
  }

  next(); // Immediately move to the next controller
};// Adjust path to your prisma client


