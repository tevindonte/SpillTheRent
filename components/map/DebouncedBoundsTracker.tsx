"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import { BOUNDS_DEBOUNCE_MS } from "@/lib/map-bounds";

type DebouncedBoundsTrackerProps = {
  onViewportChange: (bounds: LatLngBounds, zoom: number) => void;
  debounceMs?: number;
};

export function DebouncedBoundsTracker({
  onViewportChange,
  debounceMs = BOUNDS_DEBOUNCE_MS,
}: DebouncedBoundsTrackerProps) {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const emit = useCallback(() => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    onViewportChangeRef.current(bounds, zoom);
  }, [map]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(emit, debounceMs);
  }, [emit, debounceMs]);

  useMapEvents({
    moveend: schedule,
    zoomend: schedule,
  });

  useEffect(() => {
    map.whenReady(() => {
      map.invalidateSize();
      emit();
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [map, emit]);

  return null;
}
