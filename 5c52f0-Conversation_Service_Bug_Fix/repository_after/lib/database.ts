import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma_after: PrismaClient | undefined;
}
const prisma =
  globalThis.__prisma_after ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  globalThis.__prisma_after = prisma;
}

export default prisma;

