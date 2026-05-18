"use client";

import type { Complex } from "@/lib/complexes";
import { formatRent } from "@/lib/format";
import { boroughAreaLabel, type BoroughArea } from "@/lib/map-boroughs";

type BottomStatusBarProps = {
  complexes: Complex[];
  medianRent?: number | null;
  boroughArea?: BoroughArea;
};

export function BottomStatusBar({
  complexes,
  medianRent,
  boroughArea,
}: BottomStatusBarProps) {
  const count = complexes.length;
  const ratings = complexes
    .map((c) => c.google_rating)
    .filter((r): r is number => r != null);
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;
  const totalReviews = complexes.reduce((sum, c) => sum + c.review_count, 0);
  const medianLabel = formatRent(medianRent);
  const boroughLabel = boroughAreaLabel(boroughArea);

  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1000] border-t border-neutral-800/80 bg-neutral-950/90 px-4 py-2.5 backdrop-blur-md sm:left-14"
      role="status"
      aria-live="polite"
    >
      <p className="text-center text-xs text-neutral-400">
        <strong className="font-semibold text-neutral-200">
          {count.toLocaleString()}
        </strong>{" "}
        {count === 1 ? "building" : "buildings"}
        {boroughLabel ? ` in ${boroughLabel}` : " in view"}
        <span className="mx-2 text-neutral-700">·</span>
        avg rating{" "}
        <strong className="font-semibold text-neutral-200">
          {avgRating != null ? avgRating.toFixed(1) : "—"}
        </strong>
        <span className="mx-2 text-neutral-700">·</span>
        <strong className="font-semibold text-neutral-200">
          {totalReviews.toLocaleString()}
        </strong>{" "}
        {totalReviews === 1 ? "review" : "reviews"}
        {medianLabel && (
          <>
            <span className="mx-2 text-neutral-700">·</span>
            median rent{" "}
            <strong className="font-semibold text-neutral-200">{medianLabel}</strong>
          </>
        )}
      </p>
    </div>
  );
}
