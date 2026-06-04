"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLngBounds } from "leaflet";
import { fetchComplexesInBounds, type Complex, type MapFilters } from "@/lib/complexes";
import {
  expandBounds,
  getTileKeys,
  hasValidMapCoordinates,
  isInBounds,
  latLngBoundsToMapBounds,
  tileToBounds,
  type MapBounds,
} from "@/lib/map-bounds";

const MAX_CONCURRENT_TILE_FETCHES = 4;

function filtersKey(filters: MapFilters): string {
  return JSON.stringify(filters);
}

export function useViewportComplexes(filters: MapFilters = {}) {
  const cacheRef = useRef<Map<string, Complex>>(new Map());
  const fetchedTilesRef = useRef<Set<string>>(new Set());
  const pendingTilesRef = useRef<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const filtersRef = useRef(filters);
  const lastBoundsRef = useRef<{ bounds: LatLngBounds; zoom: number } | null>(
    null
  );

  filtersRef.current = filters;

  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(13);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    fetchedTilesRef.current.clear();
    pendingTilesRef.current.clear();
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

  const syncDisplayList = useCallback((viewport: MapBounds) => {
    const list: Complex[] = [];
    cacheRef.current.forEach((complex) => {
      if (
        hasValidMapCoordinates(complex) &&
        isInBounds(complex.lat, complex.lng, viewport)
      ) {
        list.push(complex);
      }
    });
    setComplexes(list);
  }, []);

  const loadForBounds = useCallback(
    async (bounds: LatLngBounds, nextZoom: number) => {
      lastBoundsRef.current = { bounds, zoom: nextZoom };
      const requestId = ++requestIdRef.current;
      setZoom(nextZoom);

      const viewport = latLngBoundsToMapBounds(bounds);
      const fetchBounds = expandBounds(viewport);
      const tileKeys = getTileKeys(fetchBounds);
      const missingTiles = tileKeys.filter(
        (key) =>
          !fetchedTilesRef.current.has(key) && !pendingTilesRef.current.has(key)
      );

      syncDisplayList(viewport);

      if (missingTiles.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const fetchTile = async (tileKey: string) => {
          if (fetchedTilesRef.current.has(tileKey)) return;

          pendingTilesRef.current.add(tileKey);
          try {
            const tileBounds = tileToBounds(tileKey);
            const batch = await fetchComplexesInBounds(
              tileBounds,
              filtersRef.current
            );
            for (const complex of batch) {
              if (hasValidMapCoordinates(complex)) {
                cacheRef.current.set(complex.id, complex);
              }
            }
            fetchedTilesRef.current.add(tileKey);
          } finally {
            pendingTilesRef.current.delete(tileKey);
          }
        };

        for (
          let i = 0;
          i < missingTiles.length;
          i += MAX_CONCURRENT_TILE_FETCHES
        ) {
          const chunk = missingTiles.slice(i, i + MAX_CONCURRENT_TILE_FETCHES);
          await Promise.all(chunk.map((tileKey) => fetchTile(tileKey)));

          if (requestIdRef.current === requestId) {
            syncDisplayList(viewport);
          }
        }
      } catch (e) {
        if (requestIdRef.current === requestId) {
          setError(e instanceof Error ? e.message : "Failed to load buildings");
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [syncDisplayList]
  );

  const noteBoundsDebounced = useCallback(() => {}, []);

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
