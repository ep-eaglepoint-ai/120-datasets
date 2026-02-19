import type { PrismaClient } from "@prisma/client";

export const CAPACITY_LIMIT_KG = 25;

export class CapacityExceededError extends Error {
  readonly code = "CAPACITY_EXCEEDED";
  constructor() {
    super("Capacity Exceeded");
  }
}

export class PackageAlreadyAssignedError extends Error {
  readonly code = "PACKAGE_ALREADY_ASSIGNED";
  constructor() {
    super("Package Already Assigned");
  }
}

export class NegativeWeightError extends Error {
  readonly code = "NEGATIVE_WEIGHT";
  constructor() {
    super("Negative Package Weight");
  }
}

export class InactiveCourierError extends Error {
  readonly code = "INACTIVE_COURIER";
  constructor() {
    super("Courier Inactive");
  }
}

export async function createPackage(
  prisma: PrismaClient,
  input: { description: string; weightKg: number }
) {
  if (input.weightKg < 0) {
    throw new NegativeWeightError();
  }
  return prisma.package.create({
    data: {
      description: input.description,
      weightKg: input.weightKg,
      status: "PENDING",
    },
  });
}

export async function getCourierRemainingCapacityKg(
  prisma: PrismaClient,
  courierId: string
) {
  const agg = await prisma.package.aggregate({
    where: { courierId, status: "ASSIGNED" },
    _sum: { weightKg: true },
  });

  const currentLoad = agg._sum.weightKg ?? 0;
  return Math.max(0, CAPACITY_LIMIT_KG - currentLoad);
}

export async function assignPendingPackageToCourier(
  prisma: PrismaClient,
  params: { courierId: string; packageId: string }
) {
  const { courierId, packageId } = params;

  return prisma.$transaction(async (tx) => {
    const courier = await tx.courier.findUnique({ where: { id: courierId } });
    if (!courier) {
      throw new Error("Courier Not Found");
    }
    if (!courier.isActive) {
      throw new InactiveCourierError();
    }

    // Acquire a write lock early so concurrent assignments serialize.
    await tx.courier.update({
      where: { id: courierId },
      data: { lockVersion: { increment: 1 } },
    });

    const pkg = await tx.package.findUnique({ where: { id: packageId } });
    if (!pkg) {
      throw new Error("Package Not Found");
    }
    if (pkg.weightKg < 0) {
      throw new NegativeWeightError();
    }
    if (pkg.status !== "PENDING" || pkg.courierId) {
      throw new PackageAlreadyAssignedError();
    }

    const agg = await tx.package.aggregate({
      where: { courierId, status: "ASSIGNED" },
      _sum: { weightKg: true },
    });
    const currentLoad = agg._sum.weightKg ?? 0;

    if (currentLoad + pkg.weightKg > CAPACITY_LIMIT_KG) {
      throw new CapacityExceededError();
    }

    const updated = await tx.package.updateMany({
      where: { id: packageId, status: "PENDING", courierId: null },
      data: { status: "ASSIGNED", courierId },
    });
    if (updated.count !== 1) {
      throw new PackageAlreadyAssignedError();
    }

    try {
      await tx.assignment.create({
        data: { courierId, packageId },
      });
    } catch {
      throw new PackageAlreadyAssignedError();
    }

    return { courierId, packageId };
  });
}
