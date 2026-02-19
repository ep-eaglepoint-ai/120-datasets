import crypto from "crypto";

// 1. Generate a valid RSA Key Pair on the fly
// This ensures the key format is always 100% correct for jsonwebtoken
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs1", // Standard OpenSSL RSA format
    format: "pem",
  },
});

// 2. Encode them to Base64 (simulating how they are stored in .env)
process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString("base64");
process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString("base64");

// 3. Set other env vars
process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";
