import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

export type TestDb = {
  prisma: PrismaClient;
  url: string;
  cleanup: () => Promise<void>;
};

export function createTestDb(): TestDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ehhfj9-db-"));
  const dbPath = path.join(dir, "test.db");
  const url = `file:${dbPath}`;

  execFileSync(
    "npx",
    [
      "prisma",
      "db",
      "push",
      "--schema",
      "repository_after/prisma/schema.prisma",
      "--skip-generate",
      "--force-reset",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: url,
      },
    }
  );

  const prisma = new PrismaClient({
    datasources: {
      db: { url },
    },
  });

  return {
    prisma,
    url,
    cleanup: async () => {
      await prisma.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
