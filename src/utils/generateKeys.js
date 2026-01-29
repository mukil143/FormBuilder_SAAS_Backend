import crypto from "crypto";
import bcrypt from "bcryptjs";

export const generateApiKeys = async () => {
  // 1. Generate Random Hex Strings
  const rawKey = `pk_live_${crypto.randomBytes(12).toString("hex")}`;
  const rawSecret = `sk_live_${crypto.randomBytes(24).toString("hex")}`;

  // 2. Hash the Secret (So if your DB is hacked, secrets are safe)
  const hashedSecret = await bcrypt.hash(rawSecret, 10);

  return { rawKey, rawSecret, hashedSecret };
};
