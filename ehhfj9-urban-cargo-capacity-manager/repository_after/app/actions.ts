"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../lib/prisma";
import { assignPendingPackageToCourier } from "../lib/core";

export async function assignPackageAction(input: {
  courierId: string;
  packageId: string;
}) {
  await assignPendingPackageToCourier(prisma, input);
  revalidatePath("/dashboard");
}
