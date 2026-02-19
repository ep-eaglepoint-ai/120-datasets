"use client";

import { useMemo, useState, useTransition } from "react";
import { assignPackageAction } from "../actions";

type CourierRow = {
  id: string;
  name: string;
  isActive: boolean;
  remainingCapacityKg: number;
};

type PendingPackageRow = {
  id: string;
  description: string;
  weightKg: number;
};

export default function AssignPanel(props: {
  couriers: CourierRow[];
  pendingPackages: PendingPackageRow[];
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const selectedPackage = useMemo(() => {
    return (
      props.pendingPackages.find((p) => p.id === selectedPackageId) ?? null
    );
  }, [props.pendingPackages, selectedPackageId]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <label>
        Pending Package
        <select
          value={selectedPackageId}
          onChange={(e) => setSelectedPackageId(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          <option value="">Select a package</option>
          {props.pendingPackages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.description} ({p.weightKg}kg)
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gap: 8 }}>
        {props.couriers.map((c) => {
          const tooHeavy = selectedPackage
            ? selectedPackage.weightKg > c.remainingCapacityKg
            : true;
          const disabled =
            isPending || !c.isActive || !selectedPackage || tooHeavy;

          return (
            <div key={c.id} style={{ border: "1px solid #ddd", padding: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <div>{c.name}</div>
                  <div>Remaining Capacity: {c.remainingCapacityKg}kg</div>
                  {!c.isActive && <div>Inactive</div>}
                </div>
                <button
                  disabled={disabled}
                  onClick={() => {
                    if (!selectedPackage) return;
                    startTransition(async () => {
                      await assignPackageAction({
                        courierId: c.id,
                        packageId: selectedPackage.id,
                      });
                    });
                  }}
                >
                  Assign
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
