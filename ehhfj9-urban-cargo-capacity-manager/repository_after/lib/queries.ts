import type { PrismaClient } from "@prisma/client";
import { CAPACITY_LIMIT_KG } from "./core";

export async function listCouriersWithRemainingCapacity(prisma: PrismaClient) {
  const couriers = await prisma.courier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });

  const loads = await prisma.package.groupBy({
    by: ["courierId"],
    where: { status: "ASSIGNED", courierId: { not: null } },
    _sum: { weightKg: true },
  });

  const loadByCourier = new Map<string, number>();
  for (const row of loads) {
    if (row.courierId) {
      loadByCourier.set(row.courierId, row._sum.weightKg ?? 0);
    }
  }

  return couriers.map((c) => {
    const currentLoad = loadByCourier.get(c.id) ?? 0;
    const remainingCapacityKg = Math.max(0, CAPACITY_LIMIT_KG - currentLoad);
    return { ...c, remainingCapacityKg };
  });
}

export async function listPendingPackages(prisma: PrismaClient) {
  return prisma.package.findMany({
    where: { status: "PENDING", courierId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, description: true, weightKg: true },
  });
}
