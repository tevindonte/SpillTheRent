"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLngBounds } from "leaflet";
import { fetchComplexesInBounds, type Complex, type MapFilters } from "@/lib/complexes";
import {
  expandBounds,
  isInBounds,
  latLngBoundsToMapBounds,
  type MapBounds,
} from "@/lib/map-bounds";
import {
  logMapPerf,
  mapPerfDelta,
  MAP_PERF_ENABLED,
  newMapPerfTrace,
} from "@/lib/map-perf";

function filtersKey(filters: MapFilters): string {
  return JSON.stringify(filters);
}

function boundsCacheKey(bounds: MapBounds, filters: MapFilters): string {
  const f = filtersKey(filters);
  return [
    bounds.south.toFixed(4),
    bounds.west.toFixed(4),
    bounds.north.toFixed(4),
    bounds.east.toFixed(4),
    f,
  ].join("|");
}

export function useViewportComplexes(filters: MapFilters = {}) {
  const cacheRef = useRef<Map<string, Complex[]>>(new Map());
  const requestIdRef = useRef(0);
  const filtersRef = useRef(filters);
  const lastBoundsRef = useRef<{ bounds: LatLngBounds; zoom: number } | null>(
    null
  );
  const debouncedAtRef = useRef<number | null>(null);

  filtersRef.current = filters;

  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(12);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  useEffect(() => {
    clearCache();
    setComplexes([]);
    if (lastBoundsRef.current) {
      const { bounds, zoom: z } = lastBoundsRef.current;
      void loadForBounds(bounds, z);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey(filters)]);

  const syncDisplayList = useCallback(
    (viewport: MapBounds, source: Complex[]) => {
      const list = source.filter((c) =>
        isInBounds(c.lat, c.lng, viewport)
      );
      setComplexes(list);
      return list;
    },
    []
  );

  const loadForBounds = useCallback(
    async (bounds: LatLngBounds, nextZoom: number) => {
      lastBoundsRef.current = { bounds, zoom: nextZoom };
      const requestId = ++requestIdRef.current;
      const traceId = newMapPerfTrace();
      const tLoad = performance.now();

      setZoom(nextZoom);

      const viewport = latLngBoundsToMapBounds(bounds);
      const fetchBounds = expandBounds(viewport);
      const cacheKey = boundsCacheKey(fetchBounds, filtersRef.current);

      if (debouncedAtRef.current != null && MAP_PERF_ENABLED) {
        mapPerfDelta(
          traceId,
          "bounds_debounced",
          "load_started",
          debouncedAtRef.current,
          tLoad
        );
        logMapPerf(traceId, "bounds_debounced", {
          debounceToLoadMs: Math.round(tLoad - debouncedAtRef.current),
        });
      }
      debouncedAtRef.current = null;

      logMapPerf(traceId, "load_started", {
        zoom: nextZoom,
        cacheKey,
        cached: cacheRef.current.has(cacheKey),
      });

      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        const list = syncDisplayList(viewport, cached);
        logMapPerf(traceId, "markers_rendered", {
          count: list.length,
          fromCache: true,
        });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const batch = await fetchComplexesInBounds(
          fetchBounds,
          filtersRef.current,
          { traceId }
        );

        if (requestIdRef.current !== requestId) return;

        cacheRef.current.set(cacheKey, batch);
        const list = syncDisplayList(viewport, batch);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (requestIdRef.current !== requestId) return;
            logMapPerf(traceId, "markers_rendered", {
              count: list.length,
              msSinceLoad: Math.round(performance.now() - tLoad),
            });
          });
        });
      } catch (e) {
        if (requestIdRef.current === requestId) {
          setError(
            e instanceof Error ? e.message : "Failed to load buildings"
          );
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [syncDisplayList]
  );

  const noteBoundsDebounced = useCallback(() => {
    debouncedAtRef.current = performance.now();
  }, []);

  return {
    complexes,
    loading,
    error,
    zoom,
    loadForBounds,
    clearCache,
    noteBoundsDebounced,
  };
}
