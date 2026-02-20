import jwt from 'jsonwebtoken'
import { prisma } from "../config/db.js";


/**
 * MIDDILEWARE to protect routes - Verify JWT token
 */

export const protect = async (req, res, next) => {
  let token;
  if (
    req.headers?.authorization?.startsWith("Bearer")
  ) {
    try {
       token = req.headers.authorization.split(" ")[1];

       const decoded = await jwt.verify(token, process.env.JWT_SECRET);

      console.log(decoded);

      req.user = await prisma.user.findUnique({
        where: {
          userId: decoded.userId,
        },
        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          plan: true,
          subscriptions: {
            where: { status: "active" },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        }
      })

      if (req.user === null || req.user === undefined || req.user === "" ) {
        return res.status(401).json({ message: "Not authorized" });
      }
      next();
    } catch (error) {
      console.log(error);
      return res.status(401).json({ success: false, message: "Not authorized Token failed" });
    }
  }
  else {
  return res.status(401).json({ success: false, message: "authorized token not found" });
}
}



export const admin = async (req, res, next) => {
  if(req.user.role === "ADMIN") {
    next();
  } else {
    return res.status(401).json({success: false, message: "Not authorized" });
  }
}

