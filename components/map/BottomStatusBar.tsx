"use client";

import type { ReactNode } from "react";
import type { Complex } from "@/lib/complexes";
import { formatRent } from "@/lib/format";
import type { MapColorMode } from "@/lib/map-color-mode";
import { boroughAreaLabel, type BoroughArea } from "@/lib/map-boroughs";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";
import { mapBuildingRent } from "@/lib/map-marker-style";

type BottomStatusBarProps = {
  complexes: Complex[];
  zoom: number;
  colorMode?: MapColorMode;
  buildingCount?: number | null;
  avgRating?: number | null;
  totalReviews?: number | null;
  medianRent?: number | null;
  boroughArea?: BoroughArea;
};

function reviewBackedCount(c: Complex): number {
  return (
    c.cached_review_count ??
    c.google_review_count ??
    c.review_count ??
    0
  );
}

export function BottomStatusBar({
  complexes,
  zoom,
  colorMode = "rating",
  buildingCount,
  avgRating: viewportAvg,
  totalReviews: viewportReviews,
  medianRent,
  boroughArea,
}: BottomStatusBarProps) {
  const mvtMode = zoom < MARKER_ZOOM_THRESHOLD;

  const markerReviews = complexes.reduce(
    (sum, c) => sum + reviewBackedCount(c),
    0
  );
  const markerRatings = complexes
    .filter((c) => reviewBackedCount(c) > 0 && c.google_rating != null)
    .map((c) => c.google_rating as number);
  const markerAvg =
    markerReviews > 0 && markerRatings.length > 0
      ? markerRatings.reduce((a, b) => a + b, 0) / markerRatings.length
      : null;

  const count =
    buildingCount != null && Number.isFinite(buildingCount)
      ? buildingCount
      : complexes.length;

  const avgRating =
    viewportAvg != null && Number.isFinite(viewportAvg)
      ? viewportAvg
      : !mvtMode
        ? markerAvg
        : null;

  const totalReviews =
    viewportReviews != null && Number.isFinite(viewportReviews)
      ? viewportReviews
      : !mvtMode
        ? markerReviews
        : 0;

  const withRentData = complexes.filter((c) => mapBuildingRent(c) != null)
    .length;

  const showAvg =
    colorMode === "rating" && avgRating != null && totalReviews > 0;
  const showReviews = colorMode === "rating" && !mvtMode && totalReviews > 0;

  const medianLabel = formatRent(medianRent);
  const boroughLabel = boroughAreaLabel(boroughArea);

  const parts: ReactNode[] = [
    <span key="buildings">
      <strong className="font-semibold text-neutral-200">
        {count.toLocaleString()}
      </strong>{" "}
      {count === 1 ? "building" : "buildings"}
      {boroughLabel ? ` in ${boroughLabel}` : " in view"}
    </span>,
  ];

  if (colorMode === "rent") {
    if (medianLabel) {
      parts.push(
        <span key="median">
          median{" "}
          <strong className="font-semibold text-neutral-200">{medianLabel}</strong>
        </span>
      );
    }
    parts.push(
      <span key="with-rent">
        <strong className="font-semibold text-neutral-200">
          {withRentData.toLocaleString()}
        </strong>{" "}
        with rent data
      </span>
    );
  } else {
    if (showAvg) {
      parts.push(
        <span key="rating">
          avg rating{" "}
          <strong className="font-semibold text-neutral-200">
            {avgRating.toFixed(1)}
          </strong>
        </span>
      );
    }

    if (showReviews) {
      parts.push(
        <span key="reviews">
          <strong className="font-semibold text-neutral-200">
            {totalReviews.toLocaleString()}
          </strong>{" "}
          {totalReviews === 1 ? "review" : "reviews"}
        </span>
      );
    }

    if (medianLabel) {
      parts.push(
        <span key="rent">
          median rent{" "}
          <strong className="font-semibold text-neutral-200">{medianLabel}</strong>
        </span>
      );
    }
  }

  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1000] border-t border-neutral-800/80 bg-neutral-950/90 px-4 py-2.5 backdrop-blur-md sm:left-14"
      role="status"
      aria-live="polite"
    >
      <p className="text-center text-xs text-neutral-400">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-2 text-neutral-700">·</span>}
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}
