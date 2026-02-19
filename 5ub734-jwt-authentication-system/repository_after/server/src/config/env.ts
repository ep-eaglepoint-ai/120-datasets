import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_PRIVATE_KEY_BASE64 || !process.env.JWT_PUBLIC_KEY_BASE64) {
  throw new Error("FATAL: JWT Keys not set in environment.");
}

export const config = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DATABASE_URL,
  security: {
    bcryptCost: Math.max(
      parseInt(process.env.BCRYPT_COST || "12", 10) || 12,
      12
    ),
  },
  jwt: {
    privateKey: Buffer.from(
      process.env.JWT_PRIVATE_KEY_BASE64,
      "base64"
    ).toString("utf-8"),
    publicKey: Buffer.from(
      process.env.JWT_PUBLIC_KEY_BASE64,
      "base64"
    ).toString("utf-8"),
    accessExpiry: "15m",
    refreshExpiryDays: 7,
  },
  corsOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(
    ","
  ),
};
