import express from "express";
import { prisma } from "../config/db.js";
import generateToken from "../utils/generateToken.js";
import { protect } from "../Middleware/authMiddleware.js";
import { authLimiter } from "../Middleware/rateLimitMiddleware.js";
import { trackActivity } from "../Middleware/activityMiddleware.js";
import crypto from "node:crypto";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import { sendEmail } from "../config/resend.js";
import { checkAccountStatus } from "../Middleware/accessGuard.js";

const router = express.Router();

/**
 * CREATE - Register User
 * POST /register
 */
router.post("/api/users/register", [authLimiter], async (req, res) => {
  try {
    let { name, email, password } = req.body;

    // 🔥 1. Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    name = name.trim();
    email = email.toLowerCase().trim();

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    // 🔥 2. Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await hashPassword(password);

    // 🔥 3. Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",
        razorpayCustomerId: null,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // 🔥 4. Get FREE plan (IMPORTANT)
    const freePlan = await prisma.plan.findFirst({
      where: {
        planType: "FREE",
        isActive: true,
      },
    });

    return res.status(201).json({
      message: "User created successfully",
      user, // optional (remove if not needed)
      plan: {
        planType: freePlan?.planType || "FREE",
        name: freePlan?.name || "Free Plan",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * LOGIN - Authenticate User
 * POST /login
 */

router.post("/api/users/login", [authLimiter], async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // 🔥 1. Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        userId: true,
        name: true,
        email: true,
        password: true,
        role: true,
        createdAt: true,
        monthlyResponseCount: true,
        AccountStatus: true, // ✅ fixed
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if(user.AccountStatus === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended.",
        errorCode: "ACCOUNT_SUSPENDED",
      });
    }


    // 🔥 2. Check password
    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // 🚨 3. Account status check
    if (user.AccountStatus === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended.",
        errorCode: "ACCOUNT_SUSPENDED",
      });
    }


    // 🔥 4. Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.userId,
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
      // ✅ FREE fallback
      plan = await prisma.plan.findFirst({
        where: {
          planType: "FREE",
          isActive: true,
        },
      });
    }

    // 🔥 5. Generate token
    const token = await generateToken({
      userId: user.userId,
      role: user.role,
    });

    // 🔥 6. Remove password
    user.password = undefined;

    return res.status(200).json({
      message: "Login successful",
      user,
      token,
      plan: {
        planType: plan?.planType || "FREE",
        name: plan?.name || "Free Plan",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * READ - Get User profile By ID
 * GET /users/:id
 */
router.get(
  "/api/users/profile",
  [protect, checkAccountStatus, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;

      // 🔥 1. Get user
      const user = await prisma.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          formCount: true,
          monthlyResponseCount: true,
          dailyResponseCount: true, // ✅ add this
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // 🔥 2. Get subscription + plan
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
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

      // 🔥 3. Calculate remaining limits
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
        message: "User profile fetched successfully",
        data: {
          ...user,
          plan: {
            planType: plan?.planType || "FREE",
            name: plan?.name || "Free Plan",
          },
          limits, // 🔥 NEW FIELD
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
 * UPDATE - Update User
 * PUT /users/:id
 */
router.put(
  "/api/users/profile/update",
  [protect, checkAccountStatus, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      let { name, email } = req.body;

      const data = {};

      if (name) data.name = name.trim();

      if (email) {
        email = email.toLowerCase().trim();

        const existing = await prisma.user.findUnique({
          where: { email },
        });

        if (existing && existing.userId !== userId) {
          return res.status(400).json({
            success: false,
            message: "Email already in use",
          });
        }

        data.email = email;
      }

      const user = await prisma.user.update({
        where: { userId },
        data,
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "User updated successfully",
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
 * DELETE - Delete User
 * DELETE /users/:id
 */
router.delete(
  "/api/users/profile/delete",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
        });
      }

      const user = await prisma.user.findUnique({
        where: { userId },
        select: {
          password: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const isMatch = await comparePassword(password, user.password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }

      // 🔥 Optional: cancel active subscription
      const sub = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "active",
        },
      });

      if (sub) {
        try {
          await razorpay.subscriptions.cancel(
            sub.razorpaySubscriptionId,
            false,
          );
        } catch (err) {
          console.error("Razorpay cancel failed:", err);
        }
      }

      // 🔥 Delete user (cascade will handle relations)
      await prisma.user.delete({
        where: { userId },
      });

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
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
 * FORGOT PASSWORD - Send reset link to email
 * POST /forgot-password
 * Access Control: Public
 */

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });
    // Send email with reset link
    try {
      const mailOptions = {
        from: "noreply@webzspot.com",
        to: email,
        subject: "Password Reset",
        html: `<p>You requested a password reset. Click the link below to reset your password:</p>
             <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}">Reset Password</a>
             <p>This link will expire in 1 hour.</p>`,
      };
      const res = await sendEmail(mailOptions);

      console.log("Email sent: " + res.messageId);
      console.log("Preview URL: " + nodemailer.getTestMessageUrl(res));
    } catch (err) {
      switch (err.code) {
        case "ECONNECTION":
        case "ETIMEDOUT":
          console.error("Network error - retry later:", err.message);
          break;
        case "EAUTH":
          console.error("Authentication failed:", err.message);
          break;
        case "EENVELOPE":
          console.error("Invalid recipients:", err.rejected);
          break;
        default:
          console.error("Send failed:", err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * RESET PASSWORD - Reset password using token
 * POST /reset-password
 * Access Control: Public
 * Request Body: { token, newPassword }
 */
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(), // Check if token is not expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }

    if (user.resetTokenExpiry < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Token has expired" });
    }

    const isSamePassword = await comparePassword(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as the old password",
      });
    }
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { userId: user.userId },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
    //send confirmation email
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Password Reset Confirmation",
        html: `<p>Your password has been reset successfully.</p>`,
      };
      const res = await sendEmail(mailOptions);

      console.log("Email sent: " + res);
    } catch (err) {
      switch (err.code) {
        case "ECONNECTION":
        case "ETIMEDOUT":
          console.error("Network error - retry later:", err.message);
          break;
        case "EAUTH":
          console.error("Authentication failed:", err.message);
          break;
        case "EENVELOPE":
          console.error("Invalid recipients:", err.rejected);
          break;
        default:
          console.error("Send failed:", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * PASSWORD CHANGE - Change password for logged in user
 * POST /api/users/change-password
 * Access Control: Private
 */
router.post(
  "/api/users/change-password",
  [protect, checkAccountStatus, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: "New password cannot be the same as the current password",
        });
      }
      const user = await prisma.user.findUnique({
        where: { userId },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      const isMatch = await comparePassword(currentPassword, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Current password is incorrect" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await prisma.user.update({
        where: { userId },
        data: { password: hashedPassword },
      });

      //send confirmation email
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: "Password Change Confirmation",
          html: `<p>Your password has been changed successfully.</p>`,
        };
        const res = await sendEmail(mailOptions);
        console.log("Email sent: " + res);
      } catch (err) {
        switch (err.code) {
          case "ECONNECTION":
          case "ETIMEDOUT":
            console.error("Network error - retry later:", err.message);
            break;
          case "EAUTH":
            console.error("Authentication failed:", err.message);
            break;
          case "EENVELOPE":
            console.error("Invalid recipients:", err.rejected);
            break;
          default:
            console.error("Send failed:", err.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
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
 * GET all plans - GET /api/plans
 * Access Control: Public
 */
router.get("/api/plans", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
      },
    });
    plans.forEach((plan) => {
      plan.amount = plan.amount / 100;
    });
    res.status(200).json({
      success: true,
      message: "Plans fetched successfully",
      data: plans,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

export default router;
