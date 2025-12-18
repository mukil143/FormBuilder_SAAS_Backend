import express from "express";
import { prisma } from "../config/db.js";
const router = express.Router();

/**
 * CREATE - Register User
 * POST /register
 */
router.post("/api/users/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * LOGIN - Authenticate User
 * POST /login
 */

router.post("/api/users/login", async (req, res) => {
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
    return res.status(200).json({ message: "Login successful", user });
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
router.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * READ - Get User By ID
 * GET /users/:id
 */
router.get("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE - Update User
 * PUT /users/:id
 */
router.put("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, password } = req.body;

    const user = await prisma.user.update({
      where: {
        userId: userId,
      },
      data: {
        name,
        email,
        password,
      },
    });

    console.log(user);

    if(!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE - Delete User
 * DELETE /users/:id
 */
router.delete("/api/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.user.delete({
      where: {
        userId: userId,
      },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
export default router;
