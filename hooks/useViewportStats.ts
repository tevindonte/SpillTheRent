"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLngBounds } from "leaflet";
import type { MapFilters } from "@/lib/complexes";
import { BOUNDS_DEBOUNCE_MS, latLngBoundsToMapBounds } from "@/lib/map-bounds";

function filtersKey(filters: MapFilters): string {
  return JSON.stringify(filters);
}

function boundsToParams(bounds: LatLngBounds, filters: MapFilters): URLSearchParams {
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchStats = useCallback((bounds: LatLngBounds) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      const params = boundsToParams(bounds, filtersRef.current);

      void fetch(`/api/complexes/viewport?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Stats failed"))))
        .then((data: { median_rent?: number | null }) => {
          if (requestIdRef.current !== requestId) return;
          const value = data.median_rent;
          setMedianRent(
            value != null && Number.isFinite(value) && value > 0 ? value : null
          );
        })
        .catch(() => {
          if (requestIdRef.current === requestId) setMedianRent(null);
        });
    }, BOUNDS_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    setMedianRent(null);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [filtersKey(filters)]);

  return { medianRent, fetchStats };
}
