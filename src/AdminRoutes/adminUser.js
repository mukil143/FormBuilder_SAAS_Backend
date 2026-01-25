import express from "express";
import { prisma } from "../config/db.js";
import { admin, protect } from "../Middleware/authMiddleware.js";
const router = express.Router();
import { trackActivity } from "../Middleware/activityMiddleware.js";
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
        where: {
          role: "USER",
        },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          lastActiveAt: true, // 👈 Fetch the timestamp
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      if (users.length === 0 || users === null || users === undefined) {
        return res.status(404).json({
          success: false,
          message: "No users found",
        });
      }

      // Define the threshold (e.g., 5 minutes)
      const FIVE_MINUTES = 5 * 60 * 1000;
      const now = new Date();

      const usersWithStatus = users.map((user) => {
        // Calculate time difference
        const lastSeen = new Date(user.lastActiveAt).getTime();
        const timeDiff = now.getTime() - lastSeen;

        // If difference is less than 5 mins, they are Online
        const isOnline = timeDiff < FIVE_MINUTES;

        return {
          ...user,
          status: isOnline ? "Active" : "Inactive",
          lastSeen: user.lastActiveAt, // Optional: Return simpler timestamp
        };
      });

      return res.status(200).json({
        success: true,
        message: "Users fetched successfully",
        data: usersWithStatus,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
      const { name, email, password, role } = req.body;
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

      console.log(existingUser);

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password,
          role,
        },
      });

      res.status(201).json({
        success: true,
        message: "User created successfully",
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

      const user = await prisma.user.update({
        where: {
          userId: id,
        },
        data: {
          name,
          email,
          password,
          role,
        },
      });

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

/**
 * Delete User
 * DELETE /api/admin/users/:id
 * Access Control: Admin
 */
router.delete(
  "/api/admin/users/:id",
  [protect, trackActivity, admin],
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await prisma.user.delete({
        where: {
          userId: id,
        },
      });

      if (user === null) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      res.status(200).json({
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
      const user = await prisma.user.findUnique({
        where: {
          userId: id,
        },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
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

      res.status(200).json({
        success: true,
        message: "User fetched successfully",
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

      if (
        !name ||
        !email ||
        !password
      ) {
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
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password,
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
      const admins = await prisma.user.findMany({
        where: {
          role: "ADMIN",
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
    } catch (error) {}
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
      if (admin.password !== password) {
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

export default router;
