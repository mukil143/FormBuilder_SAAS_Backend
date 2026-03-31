import express from "express";
import { prisma } from "../config/db.js";
import generateToken from "../utils/generateToken.js";
import { protect } from "../Middleware/authMiddleware.js";
import { authLimiter } from "../Middleware/rateLimitMiddleware.js";
import { trackActivity } from "../Middleware/activityMiddleware.js";
import crypto from "node:crypto";
import { hashPassword, comparePassword } from "../utils/hashPassword.js";
import { sendEmail } from "../config/resend.js";

const router = express.Router();

/**
 * CREATE - Register User
 * POST /register
 */
router.post("/api/users/register", [authLimiter], async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
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

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
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
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        userId: true,
        name: true,
        email: true,
        password: true,
        role: true,
        createdAt: true,
        plan: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User  not found" });
    }

    if (user.email !== email.toLowerCase()) {
      return res.status(401).json({
        message: "Email not found",
      });
    }

    const isMatch = await comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    user.password = undefined; // Remove password from user object

    const token = await generateToken(user);
    return res.status(200).json({ message: "Login successful", user, token });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal server ", error: error.message });
  }
});

/**
 * READ - Get User profile By ID
 * GET /users/:id
 */
router.get("/api/users/profile", [protect, trackActivity], async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await prisma.user.findUnique({
      where: {
        userId: userId,
      },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        plan: true,
      },
    });

    if (user === null || user === undefined || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
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
});

/**
 * UPDATE - Update User
 * PUT /users/:id
 */
router.put(
  "/api/users/profile/update",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { name, email } = req.body;

      const user = await prisma.user.update({
        where: {
          userId: userId,
        },

        data: {
          name,
          email,
        },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({
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
        return res
          .status(400)
          .json({ success: false, message: "Password is required" });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          userId: userId,
        },
        select: {
          password: true,
          userId: true,
        },
      });

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      if (user.userId !== userId) {
        return res
          .status(401)
          .json({ success: false, message: "Not authorized" });
      }

      const isMatch = await comparePassword(password, user.password);

      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid password" });
      }

      await prisma.user.delete({
        where: {
          userId: userId,
        },
      });

      res
        .status(200)
        .json({ success: true, message: "User deleted successfully" });
    } catch (error) {
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
  [protect, trackActivity],
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

export default router;
