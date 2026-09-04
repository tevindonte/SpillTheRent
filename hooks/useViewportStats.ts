"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapFilters } from "@/lib/complexes";
import {
  BOUNDS_DEBOUNCE_MS,
  latLngBoundsToMapBounds,
  type BoundsLike,
} from "@/lib/map-bounds";

function filtersKey(filters: MapFilters): string {
  return JSON.stringify(filters);
}

function boundsToParams(bounds: BoundsLike, filters: MapFilters): URLSearchParams {
  const mb = latLngBoundsToMapBounds(bounds);
  const params = new URLSearchParams({
    south: String(mb.south),
    north: String(mb.north),
    west: String(mb.west),
    east: String(mb.east),
  });
  if (filters.boroughArea && filters.boroughArea !== "all") {
    params.set("boroughArea", filters.boroughArea);
  }
  if (filters.rentStabilizedOnly) params.set("rentStabilizedOnly", "true");
  if (filters.hasHpdViolations) params.set("hasHpdViolations", "true");
  if (filters.minGoogleRating != null && filters.minGoogleRating > 0) {
    params.set("minGoogleRating", String(filters.minGoogleRating));
  }
  return params;
}

export function useViewportStats(filters: MapFilters = {}) {
  const [medianRent, setMedianRent] = useState<number | null>(null);
  const [buildingCount, setBuildingCount] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchStats = useCallback((bounds: BoundsLike) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      const params = boundsToParams(bounds, filtersRef.current);

      void fetch(`/api/complexes/viewport?${params}`)
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("Stats failed"))
        )
        .then(
          (data: {
            median_rent?: number | null;
            building_count?: number | null;
            avg_rating?: number | null;
            total_reviews?: number | null;
          }) => {
            if (requestIdRef.current !== requestId) return;
            const value = data.median_rent;
            setMedianRent(
              value != null && Number.isFinite(value) && value > 0
                ? value
                : null
            );
            const count = data.building_count;
            setBuildingCount(
              count != null && Number.isFinite(count) ? count : null
            );
            const avg = data.avg_rating;
            setAvgRating(
              avg != null && Number.isFinite(avg) ? avg : null
            );
            const reviews = data.total_reviews;
            setTotalReviews(
              reviews != null && Number.isFinite(reviews) ? reviews : null
            );
          }
        )
        .catch(() => {
          if (requestIdRef.current === requestId) {
            setMedianRent(null);
            setBuildingCount(null);
            setAvgRating(null);
            setTotalReviews(null);
          }
        });
    }, BOUNDS_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    setMedianRent(null);
    setBuildingCount(null);
    setAvgRating(null);
    setTotalReviews(null);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [filtersKey(filters)]);

  return {
    medianRent,
    buildingCount,
    avgRating,
    totalReviews,
    fetchStats,
  };
}
