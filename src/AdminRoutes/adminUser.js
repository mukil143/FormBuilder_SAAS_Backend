import express from "express";
import { prisma } from "../config/db.js";
import { admin, protect } from "../Middleware/authMiddleware.js";
const router = express.Router();

/**
 * GET ALL USERS
 * GET /api/admin/users
 * Access Control: Admin
 */
router.get("/api/admin/users", [protect,admin],async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    if (users.length === 0 || users === null || users === undefined) {
      return res.status(404).json({
        success: false,
        message: "No users found",
      });
    }
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/**
 * Create User
 * POST /api/admin/users
 * Access Control: Admin
 */
router.post("/api/admin/users",[protect,admin], async (req, res) => {
  try {
    const { name, email, password, role} = req.body;
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
});


/**
 * Update User
 * PUT /api/admin/users/:id
 * Access Control: Admin
 */
router.put("/api/admin/users/:id",[protect,admin], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    if  (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      })
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      })
    }


    const user = await prisma.user.update({
      where: {
        userId: id
      },
      data: {
        name,
        email,
        password,
        role,
      },
    });

    if(user === null) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user,
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
})

/**
 * Delete User
 * DELETE /api/admin/users/:id
 * Access Control: Admin
 */
router.delete("/api/admin/users/:id", [protect,admin],async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.delete({
      where: {
        userId: id,
      },
    });

    if(user === null) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
});


/**
 * GET USER BY ID
 * GET /api/admin/users/:id
 * Access Control: Admin
 */

router.get("/api/admin/users/:id", [protect,admin],async (req, res) => {
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
        form :{
          select:{
            formId: true,
            title: true,
            description: true,
          }
        }
      },
    });

    if(!user){
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user,
    })



  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
});



export default router
