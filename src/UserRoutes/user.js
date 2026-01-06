import express from "express";
import { prisma } from "../config/db.js";
import generateToken from "../utils/generateToken.js";
import { protect } from "../Middleware/authMiddleware.js";
import { authLimiter } from "../Middleware/rateLimitMiddleware.js";
const router = express.Router();

/**
 * CREATE - Register User
 * POST /register
 */
router.post("/api/users/register",[authLimiter], async (req, res) => {
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
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * LOGIN - Authenticate User
 * POST /login
 */

router.post("/api/users/login", [authLimiter],async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User  not found" });
    }
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

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
 * READ - Get All Users
 * GET /users
 */
// router.get("/api/users", async (req, res) => {
//   try {
//     const users = await prisma.user.findMany();
//     res.status(200).json(users);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

/**
 * READ - Get User profile By ID
 * GET /users/:id
 */
router.get("/api/users/profile",[protect], async (req, res) => {
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
      },
    });

    if (user === null || user === undefined || user === "" || !user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({success: true, message: "User profile fetched successfully", data: user});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: "Internal server error", error: error.message });
  }
});

/**
 * UPDATE - Update User
 * PUT /users/:id
 */
router.put("/api/users/profile/update", [protect],async (req, res) => {
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
      }
    });


    if(!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: "Internal server error", error: error.message });
  }
});

/**
 * DELETE - Delete User
 * DELETE /users/:id
 */
router.delete("/api/users/profile/delete", [protect],async (req, res) => {
  try {
    const { userId } = req.user;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({success: false,message: "Password is required" });
    }

    if(password.length < 6) {
      return res.status(400).json({success: false,message: "Password must be at least 6 characters" });
    }


    const user = await prisma.user.findUnique({
      where: {
        userId: userId,
      },
      select: {
        password: true,
        userId: true,
      }

    });

    if(user.userId !== userId){
      return res.status(401).json({success: false, message: "Not authorized" });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false,message: "Invalid password" });
    }

    await prisma.user.delete({
      where: {
        userId: userId,
      },
    });

    res.status(200).json({success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({success: false, message: "Internal server error", error: error.message });
  }
});
export default router;
