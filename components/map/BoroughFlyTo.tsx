"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { BoroughArea } from "@/lib/map-boroughs";
import { BOROUGH_FLY_TO } from "@/lib/map-boroughs";

export function BoroughFlyTo({ boroughArea }: { boroughArea?: BoroughArea }) {
  const map = useMap();
  const prevRef = useRef<BoroughArea | undefined>(undefined);

  useEffect(() => {
    if (!boroughArea || boroughArea === "all") {
      prevRef.current = boroughArea;
      return;
    }
    if (prevRef.current === boroughArea) return;
    prevRef.current = boroughArea;

    const { center, zoom } = BOROUGH_FLY_TO[boroughArea];
    map.flyTo(center, zoom, { duration: 0.55 });
  }, [boroughArea, map]);

  return null;
}
