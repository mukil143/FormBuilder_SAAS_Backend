import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";

export const apiKeyAuth = async (req, res, next) => {
  try {
    // 1. Get keys from headers
    const publicKey = req.headers["x-api-key"];
    const secretKey = req.headers["x-api-secret"];

    if (!publicKey || !secretKey) {
      return res.status(401).json({
        success: false,
        message: "Missing x-api-key or x-api-secret headers"
      });
    }

    // 2. Find the Public Key in DB
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: publicKey },
      include: { user: true } // Fetch the owner
    });

    if (!keyRecord) {
      return res.status(401).json({ success: false, message: "Invalid API Key" });
    }

    // 3. Validate the Secret Key (Compare raw input vs hashed DB value)
    const isMatch = await bcrypt.compare(secretKey, keyRecord.secret);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid API Secret" });
    }

    // 4. Update Usage Stats (Optional)
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() }
    });

    // 5. Attach User to Request
    // This allows your controllers to work exactly as if the user was logged in!
    req.user = keyRecord.user;
    next();

  } catch (error) {
    console.error("API Auth Error:", error);
    res.status(500).json({ success: false, message: "Authentication failed" });
  }
};
