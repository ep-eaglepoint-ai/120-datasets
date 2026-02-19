import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __urbancargo_prisma: PrismaClient | undefined;
}

export function createPrismaClient() {
  return new PrismaClient();
}

export const prisma = globalThis.__urbancargo_prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__urbancargo_prisma = prisma;
}
