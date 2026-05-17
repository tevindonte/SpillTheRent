import { Suspense } from "react";
import { NetEffectiveRentCalculator } from "@/components/calculator/NetEffectiveRentCalculator";

export default function CalculatorPage() {
  return (
    <div className="min-h-[calc(100vh-3rem)] pt-12">
      <Suspense
        fallback={
          <p className="px-4 py-8 text-sm text-neutral-500">Loading calculator…</p>
        }
      >
        <NetEffectiveRentCalculator />
      </Suspense>
    </div>
  );
}
