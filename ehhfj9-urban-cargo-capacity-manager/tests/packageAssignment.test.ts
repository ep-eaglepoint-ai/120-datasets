import { afterEach, describe, expect, it } from "vitest";

import { createTestDb } from "./testDb";

export const core = await import("../repository_after/lib/core");

type CleanupFn = () => Promise<void>;
let cleanupFns: CleanupFn[] = [];

afterEach(async () => {
  for (const fn of cleanupFns.splice(0)) {
    await fn();
  }
});

describe("Package Assignment (atomic capacity + integrity)", () => {
  it("happy path: assigning 5kg reduces remaining capacity 25 -> 20", async () => {
    const { prisma, cleanup } = createTestDb();
    cleanupFns.push(cleanup);

    const courier = await prisma.courier.create({
      data: { name: "Alice", isActive: true },
    });

    const pkg = await prisma.package.create({
      data: { description: "Box", weightKg: 5, status: "PENDING" },
    });

    await core.assignPendingPackageToCourier(prisma, {
      courierId: courier.id,
      packageId: pkg.id,
    });

    const remaining = await core.getCourierRemainingCapacityKg(
      prisma,
      courier.id
    );
    expect(remaining).toBe(20);

    const assignedSum = await prisma.package.aggregate({
      where: { courierId: courier.id, status: "ASSIGNED" },
      _sum: { weightKg: true },
    });
    expect(assignedSum._sum.weightKg ?? 0).toBe(5);
  });

  it("concurrency: two dispatchers assigning 15kg each, only one succeeds (Capacity Exceeded)", async () => {
    const { prisma, cleanup } = createTestDb();
    cleanupFns.push(cleanup);

    const courier = await prisma.courier.create({
      data: { name: "Bob", isActive: true },
    });

    const p1 = await prisma.package.create({
      data: { description: "P1", weightKg: 15, status: "PENDING" },
    });
    const p2 = await prisma.package.create({
      data: { description: "P2", weightKg: 15, status: "PENDING" },
    });

    const [r1, r2] = await Promise.allSettled([
      core.assignPendingPackageToCourier(prisma, {
        courierId: courier.id,
        packageId: p1.id,
      }),
      core.assignPendingPackageToCourier(prisma, {
        courierId: courier.id,
        packageId: p2.id,
      }),
    ]);

    const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
    const rejected = [r1, r2].filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      core.CapacityExceededError
    );
    expect(
      ((rejected[0] as PromiseRejectedResult).reason as Error).message
    ).toBe("Capacity Exceeded");

    const remaining = await core.getCourierRemainingCapacityKg(
      prisma,
      courier.id
    );
    expect(remaining).toBe(core.CAPACITY_LIMIT_KG - 15);
  });

  it("rejects assigning to inactive courier", async () => {
    const { prisma, cleanup } = createTestDb();
    cleanupFns.push(cleanup);

    const courier = await prisma.courier.create({
      data: { name: "Inactive", isActive: false },
    });
    const pkg = await prisma.package.create({
      data: { description: "Box", weightKg: 1, status: "PENDING" },
    });

    await expect(
      core.assignPendingPackageToCourier(prisma, {
        courierId: courier.id,
        packageId: pkg.id,
      })
    ).rejects.toBeInstanceOf(core.InactiveCourierError);
  });

  it("prevents negative weights from being created", async () => {
    const { prisma, cleanup } = createTestDb();
    cleanupFns.push(cleanup);

    await expect(
      core.createPackage(prisma, { description: "Bad", weightKg: -1 })
    ).rejects.toBeInstanceOf(core.NegativeWeightError);
  });

  it("prevents a package being assigned to two couriers", async () => {
    const { prisma, cleanup } = createTestDb();
    cleanupFns.push(cleanup);

    const c1 = await prisma.courier.create({
      data: { name: "C1", isActive: true },
    });
    const c2 = await prisma.courier.create({
      data: { name: "C2", isActive: true },
    });
    const pkg = await prisma.package.create({
      data: { description: "Unique", weightKg: 1, status: "PENDING" },
    });

    await core.assignPendingPackageToCourier(prisma, {
      courierId: c1.id,
      packageId: pkg.id,
    });

    await expect(
      core.assignPendingPackageToCourier(prisma, {
        courierId: c2.id,
        packageId: pkg.id,
      })
    ).rejects.toBeInstanceOf(core.PackageAlreadyAssignedError);
  });

  it("allows exactly 25kg but rejects anything above", async () => {
    const { prisma, cleanup } = createTestDb();
    cleanupFns.push(cleanup);

    const courier = await prisma.courier.create({
      data: { name: "Exact", isActive: true },
    });
    const p25 = await prisma.package.create({
      data: { description: "25kg", weightKg: 25, status: "PENDING" },
    });

    await core.assignPendingPackageToCourier(prisma, {
      courierId: courier.id,
      packageId: p25.id,
    });
    expect(await core.getCourierRemainingCapacityKg(prisma, courier.id)).toBe(
      0
    );

    const pSmall = await prisma.package.create({
      data: { description: "tiny", weightKg: 0.1, status: "PENDING" },
    });

    await expect(
      core.assignPendingPackageToCourier(prisma, {
        courierId: courier.id,
        packageId: pSmall.id,
      })
    ).rejects.toBeInstanceOf(core.CapacityExceededError);
  });
});
