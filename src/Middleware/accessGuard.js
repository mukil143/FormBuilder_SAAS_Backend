import { prisma } from "../config/db.js";
import { PLAN_LIMITS } from "../config/plans.js";

// ------------------------------------------------------------------
// 1. FORM CREATION GUARD (Used when user creates a new form)
// ------------------------------------------------------------------
export const checkFormList = async (req, res, next) => {
  try {
    const { userId, plan } = req.user;

    if (PLAN_LIMITS[plan].maxForms === Infinity) {
      return next(); // No limit, allow form creation
    }

    const formCount = await prisma.form.count({
      where: { userId },
    });

    if (formCount >= PLAN_LIMITS[plan].maxForms) {
      return res.status(403).json({
        success: false,
        message: `Form creation limit reached for ${plan} plan. Please upgrade to create more forms.`,
      });
    } else {
      next(); // Allow form creation
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ------------------------------------------------------------------
// 2. RESPONSE GUARD (Used when a public user submits a form)
// ------------------------------------------------------------------

export const checkResponseLimit = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const form = await prisma.form.findUnique({
      where: { slug: slug.toLowerCase() },
      include: { user: true }, // Include the user to get their plan
    });

    if (!form) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    const userPlan = form.user.plan;

    if (PLAN_LIMITS[userPlan].maxResponses === Infinity) {
      return next(); // No limit, allow response submission
    }

    const responseCount = await prisma.formResponse.count({
      where: { formId: form.formId },
    });

    if (responseCount >= PLAN_LIMITS[userPlan].maxResponses) {
      return res.status(403).json({
        success: false,
        message: `Response limit reached for this form under ${userPlan} plan. Please upgrade to receive more responses.`,
      });
    } else {
      next(); // Allow response submission
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// ------------------------------------------------------------------
// 3. API ACCESS GUARD (Used for developer API routes)
// ------------------------------------------------------------------

export const checkAPIAccess = async (req, res, next) => {
  try {
    const {  plan } = req.user;
    const method = req.method; // GET, POST, etc.
    const apiAccessLevel = PLAN_LIMITS[plan].apiAccess;
    
    if (apiAccessLevel === "NONE") {
      return res.status(403).json({
        success: false,
        message: `API access is not available for ${plan} plan. Please upgrade to access API features.`,
      });
    }

    if (apiAccessLevel === "READ" && method !== "GET") {
      return res.status(403).json({
        success: false,
        message: `API access is limited to read-only for ${plan} plan. Please upgrade to access full API features.`,
      });
    }

    if (apiAccessLevel === "FULL") {
      return next(); // Full API access, allow all methods
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}


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
    if (user.status === "SUSPENDED") {
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
