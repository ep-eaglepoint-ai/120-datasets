import { prisma } from "../../lib/prisma";
import {
  listCouriersWithRemainingCapacity,
  listPendingPackages,
} from "../../lib/queries";
import AssignPanel from "./AssignPanel";

export default async function DashboardPage() {
  const [couriers, pendingPackages] = await Promise.all([
    listCouriersWithRemainingCapacity(prisma),
    listPendingPackages(prisma),
  ]);

  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <h1>UrbanCargo Dispatcher</h1>
      <AssignPanel couriers={couriers} pendingPackages={pendingPackages} />
    </main>
  );
}
