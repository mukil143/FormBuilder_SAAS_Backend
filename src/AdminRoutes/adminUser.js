import express from "express";
import { prisma } from "../config/db.js";
import { admin, protect } from "../Middleware/authMiddleware.js";
const router = express.Router();
import { trackActivity } from "../Middleware/activityMiddleware.js";
import { comparePassword, hashPassword } from "../utils/hashPassword.js";
import { razorpay } from "../config/razorpay.js";
import {
  createPlatformPlan,
  deletePlatformPlan,
  savePlatformRazorpayKeys,
  updatePlatformPlan,
} from "../controllers/adminPaymentController.js";
/**
 * GET ALL USERS
 * GET /api/admin/users
 * Access Control: Admin
 */
router.get(
  "/api/admin/users",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        where: { role: "USER" },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          lastActiveAt: true,
          createdAt: true,
          formCount: true,
          monthlyResponseCount: true,
          AccountStatus: true, // ✅ fixed
          subscriptions: {
            where: { status: "active" },
            take: 1,
            include: {
              planDetails: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!users || users.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No users found",
        });
      }

      const FIVE_MINUTES = 5 * 60 * 1000;
      const now = new Date();

      // 🔥 Get FREE plan once (optimization)
      const freePlan = await prisma.plan.findFirst({
        where: { planType: "FREE", isActive: true },
      });

      const usersWithStatus = users.map((user) => {
        const lastSeen = new Date(user.lastActiveAt).getTime();
        const isOnline = now.getTime() - lastSeen < FIVE_MINUTES;

        const activeSub = user.subscriptions[0];
        const plan = activeSub ? activeSub.planDetails : freePlan;

        return {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          formCount: user.formCount,
          monthlyResponseCount: user.monthlyResponseCount,
          accountStatus: user.accountStatus,

          // 🔥 Plan info
          plan: {
            planType: plan?.planType || "FREE",
            name: plan?.name || "Free Plan",
          },

          // 🔥 Status
          status: isOnline ? "Online" : "Offline",
          lastSeen: user.lastActiveAt,
        };
      });

      return res.status(200).json({
        success: true,
        message: "Users fetched successfully",
        data: usersWithStatus,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Create User
 * POST /api/admin/users
 * Access Control: Admin
 */
router.post(
  "/api/admin/users",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      let { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      name = name.trim();
      email = email.toLowerCase().trim();
      role = role || "USER";

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role,
        },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      // 🔥 FREE plan for response
      const freePlan = await prisma.plan.findFirst({
        where: { planType: "FREE", isActive: true },
      });

      return res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          ...user,
          plan: {
            planType: freePlan?.planType || "FREE",
            name: freePlan?.name || "Free Plan",
          },
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Update User
 * PUT /api/admin/users/:id
 * Access Control: Admin
 */
router.put(
  "/api/admin/users/:id",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password, role } = req.body;
      if (!name || !email) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }
      if (password && password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }
      let user;
      if (password) {
        const hasedPassword = await hashPassword(password);
        user = await prisma.user.update({
          where: {
            userId: id,
          },
          data: {
            name,
            email,
            password: hasedPassword,
            role,
          },
        });
      } else {
        user = await prisma.user.update({
          where: {
            userId: id,
          },
          data: {
            name,
            email,
            role,
          },
        });
      }

      if (user === null) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      res.status(200).json({
        success: true,
        message: "User updated successfully",
        user,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

// /**
//  * Delete User
//  * DELETE /api/admin/users/:id
//  * Access Control: Admin
//  */
// router.delete(
//   "/api/admin/users/:id",
//   [protect, trackActivity, admin],
//   async (req, res) => {
//     try {
//       const { id } = req.params;
//       const user = await prisma.user.delete({
//         where: {
//           userId: id,
//         },
//       });

//       if (user === null) {
//         return res.status(404).json({
//           success: false,
//           message: "User not found",
//         });
//       }
//       res.status(200).json({
//         success: true,
//         message: "User deleted successfully",
//       });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//         error: error.message,
//       });
//     }
//   },
// );

/**
 * GET USER BY ID
 * GET /api/admin/users/:id
 * Access Control: Admin
 */

router.get(
  "/api/admin/users/:id",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { id } = req.params;

      // 🔥 1. Get user
      const user = await prisma.user.findUnique({
        where: { userId: id },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          formCount: true,
          monthlyResponseCount: true,
          dailyResponseCount: true, // ✅ add
          AccountStatus: true, // ✅ fixed
          form: {
            select: {
              formId: true,
              title: true,
              description: true,
              sharedUrl: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // 🔥 2. Get subscription + plan
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId: id,
          status: "active",
        },
        include: {
          planDetails: true,
        },
      });

      let plan;

      if (subscription) {
        plan = subscription.planDetails;
      } else {
        plan = await prisma.plan.findFirst({
          where: { planType: "FREE", isActive: true },
        });
      }

      // 🔥 3. Calculate limits
      const limits = {
        monthly: {
          used: user.monthlyResponseCount,
          limit: plan?.monthlyResponseLimit ?? 0,
          remaining: Math.max(
            (plan?.monthlyResponseLimit ?? 0) - user.monthlyResponseCount,
            0,
          ),
        },
        daily: {
          used: user.dailyResponseCount,
          limit: plan?.dailyResponseLimit ?? 0,
          remaining: Math.max(
            (plan?.dailyResponseLimit ?? 0) - user.dailyResponseCount,
            0,
          ),
        },
        forms: {
          used: user.formCount,
          limit: plan?.activeFormLimit ?? 0,
          remaining: Math.max((plan?.activeFormLimit ?? 0) - user.formCount, 0),
        },
        apiKeys: {
          limit: plan?.apiKeyLimit ?? 0,
        },
        users: {
          limit: plan?.userLimit ?? 0,
        },
      };

      return res.status(200).json({
        success: true,
        message: "User fetched successfully",
        data: {
          ...user,
          plan: {
            planType: plan?.planType || "FREE",
            name: plan?.name || "Free Plan",
          },
          limits,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * GET ALL FORMS
 * GET /api/admin/forms
 * Access Control: Admin
 */
router.get(
  "/api/admin/forms",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const forms = await prisma.form.findMany({
        where: {
          user: {
            role: "USER",
          },
        },
        include: {
          user: {
            select: {
              userId: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
      if (forms.length === 0 || forms === null || forms === undefined) {
        return res.status(404).json({
          success: false,
          message: "No forms found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Forms fetched successfully",
        data: forms,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * GET Form BY ID
 * GET /api/admin/form/:formId
 * Access Control: Admin
 */
router.get(
  "/api/admin/form/:formId",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { formId } = req.params;
      const form = await prisma.form.findUnique({
        where: {
          formId: formId,
        },
        include: {
          formField: true,
        },
      });

      if (form === null || form === undefined) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }
      res.status(200).json({
        success: true,
        message: "Form fetched successfully",
        data: form,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Get Form Responses
 * GET /api/admin/form/responses/:formId
 * Access Control: Admin
 */
router.get(
  "/api/admin/form/responses/:formId",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { formId } = req.params;
      const form = await prisma.form.findUnique({
        where: {
          formId: formId,
        },
        include: {
          formResponse: {
            select: {
              formResponseId: true,
              createdAt: true,
              form: {
                select: {
                  title: true,
                },
              },
              responseValue: {
                select: {
                  formFieldId: true,
                  value: true,
                  formField: {
                    select: {
                      label: true,
                      type: true,
                      options: true,
                      order: true,
                      required: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (form === null || form === undefined) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Form responses fetched successfully",
        data: form.formResponse,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Create Admin User
 * POST /api/admin/admins
 * Access Control: Admin
 */
router.post(
  "/api/admin/admins",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const existingUser = await prisma.user.findUnique({
        where: {
          email,
        },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: "ADMIN",
        },
      });

      res.status(201).json({
        success: true,
        message: "Admin created successfully",
        data: user,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Get all Admins
 * GET /api/admin/admins
 * Access Control: Admin
 */
router.get(
  "/api/admin/admins",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const admins = await prisma.user.findMany({
        where: {
          role: "ADMIN",
          userId: {
            not: userId, // Exclude the currently logged-in admin from the list
          },
        },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      if (admins.length === 0 || admins === null || admins === undefined) {
        return res.status(404).json({
          success: false,
          message: "No admins found",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Admins fetched successfully",
        data: admins,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Update Admin roles
 * PATCH /api/admin/admins/:userId
 * Access Control: Admin
 */
router.patch(
  "/api/admin/admins/:userId",
  [protect, trackActivity, admin],
  async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
    try {
      if (role.toUpperCase() === "USER") {
        // Downgrade to USER
        const updatedUser = await prisma.user.update({
          where: { userId: userId },
          data: { role: "USER" },
        });
        if (!updatedUser) {
          return res.status(404).json({
            success: false,
            message: "Admin not found",
          });
        }
        return res.status(200).json({
          success: true,
          message: "Admin role updated successfully",
          data: updatedUser,
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Delete Admin
 * DELETE /api/admin/admins/:userId
 * Access Control: Admin
 */
router.delete(
  "/api/admin/admins/:userId",
  [protect, trackActivity, admin],
  async (req, res) => {
    const { userId } = req.params;
    const { password } = req.body;
    const adminUserId = req.user.userId;
    try {
      const admin = await prisma.user.findUnique({
        where: { userId: adminUserId },
      });
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      const isMatch = await comparePassword(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Password is incorrect",
        });
      }
      const deletedAdmin = await prisma.user.delete({
        where: { userId: userId },
      });
      if (!deletedAdmin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Admin deleted successfully",
        data: deletedAdmin,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * update the account status of a user (suspend/reactivate)
 * PATCH /api/admin/users/:userId/status
 * Access Control: Admin
 */
router.patch(
  "/api/admin/users/:userId/status",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { userId } = req.params; // The ID in the URL
      const { status } = req.body; // "ACTIVE" or "SUSPENDED"

      // 1. Validate the input
      if (!["ACTIVE", "SUSPENDED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Must be ACTIVE or SUSPENDED.",
        });
      }

      // 2. Prevent the admin from accidentally suspending themselves
      if (req.user.userId === userId) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own account status.",
        });
      }

      // 3. Find the user first to make sure they exist
      const user = await prisma.user.findUnique({
        where: { userId: userId },
        select: {
          userId: true,
          email: true,
          AccountStatus: true,
          subscriptions: {
            where: { status: "active" },
            select: { razorpaySubscriptionId: true },
          },
        },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      if (user.AccountStatus === status) {
        return res.status(400).json({
          success: false,
          message: `User is already ${status}.`,
        });
      }

      // 4. Update the user's status in the database
      const updatedUser = await prisma.user.update({
        where: { userId: userId },
        data: { AccountStatus: status },
      });

      // 5. Optional: If suspending, you might want to automatically cancel their active Razorpay subscription here

      console.log("razorpay subs:", user.subscriptions);

      if (status === "SUSPENDED" && user.subscriptions.length > 0) {
        await razorpay.subscriptions.cancel(
          user.subscriptions[0].razorpaySubscriptionId,
          false,
        );
      }

      res.status(200).json({
        success: true,
        message: `User ${updatedUser.email} has been successfully marked as ${status}.`,
        data: {
          userId: updatedUser.userId,
          email: updatedUser.email,
          status: updatedUser.AccountStatus,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

/**
 * Admin Routes to manage Razorpay keys and plans will go here (if needed)
 * For example:
 * - POST /api/admin/payment/keys to set Razorpay keys
 * - POST /api/admin/payment/plans to create subscription plans
 * - GET /api/admin/payment/plans to list subscription plans
 * - etc.
 */
router.post(
  "/api/admin/payment/keys",
  [protect, trackActivity, admin],
  savePlatformRazorpayKeys,
);

router.post(
  "/api/admin/payment/plans",
  [protect, trackActivity, admin],
  createPlatformPlan,
);
// Get all plans (for admin dashboard)
router.get(
  "/api/admin/payment/plans",
  [protect, trackActivity, admin],
  async (req, res) => {
    const plans = await razorpay.plans.all();
    if (!plans) {
      return res.status(404).json({
        success: false,
        message: "No plans found",
      });
    }
    plans.items.forEach((plan) => {
      plan.amount = plan.amount / 100; // Convert from paise to rupees
    });
    res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data: plans,
    });
  },
);

/**
 * update the existing plan
 * PUT /api/admin/payment/plans/:planId
 * Access Control: Admin
 */
router.put(
  "/api/admin/payment/plans/:planId",
  [protect, trackActivity, admin],
  updatePlatformPlan,
);

/**
 * Delete a plan
 * DELETE /api/admin/payment/plans/:planId
 * Access Control: Admin
 * Note: Deleting a plan that has active subscriptions can cause issues. Consider implementing a "deactivate" feature instead of hard deletion in production.
 */
router.delete(
  "/api/admin/payment/plans",
  [protect, trackActivity, admin],
  deletePlatformPlan,
);

/**
 * Get all plans
 * GET /api/admin/payment/plans
 * Access Control: Admin
 */

export default router;
