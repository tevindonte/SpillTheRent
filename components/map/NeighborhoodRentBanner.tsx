"use client";

import { formatRentFull } from "@/lib/format";

type NeighborhoodRentBannerProps = {
  neighborhood: string | null;
  medianRent: number | null;
  reportCount: number;
};

export function NeighborhoodRentBanner({
  neighborhood,
  medianRent,
  reportCount,
}: NeighborhoodRentBannerProps) {
  if (!neighborhood || medianRent == null || reportCount < 3) return null;

  const rentLabel = formatRentFull(medianRent);
  if (!rentLabel) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-12 left-0 right-0 z-[1001] flex justify-center px-3 sm:left-14 sm:bottom-14"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-lg rounded-xl border border-orange-500/40 bg-neutral-950/95 px-4 py-2.5 text-center shadow-lg backdrop-blur-md">
        <p className="text-sm font-semibold text-neutral-50">
          Median rent in {neighborhood}: {rentLabel}/mo
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-400">
          Based on {reportCount.toLocaleString()} tenant report
          {reportCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
