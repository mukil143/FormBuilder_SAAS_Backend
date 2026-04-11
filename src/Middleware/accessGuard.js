




/**
 * 4. ACCOUNT STATUS GUARD (Used for all authenticated routes to check if user's account is suspended)
 *    - This should be used after the JWT auth middleware, so that req.user is already populated.
 */

export const checkAccountStatus = async (req, res, next) => {
  try {
    // 🚨 IMPORTANT: This must run AFTER your JWT auth middleware,
    // so req.user is already fetched from the database and attached.
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    // Check if the account is suspended
    if (user.AccountStatus === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended. Please contact support to restore access.",
        errorCode: "ACCOUNT_SUSPENDED" // Helpful for the frontend to show a specific UI screen
      });
    }

    // If their status is ACTIVE, let them pass to the controller
    next();
  } catch (error) {
    console.error("Account Status Check Error:", error);
    res.status(500).json({ success: false, message: "Error verifying account status" });
  }
};
