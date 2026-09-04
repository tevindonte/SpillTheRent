"use client";

import { useEffect, useMemo } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { MapFilters } from "@/lib/complexes";
import { buildMvtTileUrl } from "@/lib/mvt-url";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";

type MapLibreMvtLayerProps = {
  filters: MapFilters;
  zoom: number;
  onBuildingId: (id: string) => void;
};

function absoluteMvtTiles(filters: MapFilters): string {
  const path = buildMvtTileUrl(filters);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function MapLibreMvtLayer({
  filters,
  zoom,
  onBuildingId,
}: MapLibreMvtLayerProps) {
  const { current: mapRef } = useMap();
  const tilesUrl = useMemo(() => absoluteMvtTiles(filters), [filters]);
  const showMvt = zoom < MARKER_ZOOM_THRESHOLD;

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const onClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id;
      if (id == null) return;
      onBuildingId(String(id));
      map.flyTo({
        center: e.lngLat,
        zoom: Math.max(map.getZoom(), 15),
        duration: 800,
        essential: true,
      });
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", "buildings-dots", onClick);
    map.on("mouseenter", "buildings-dots", onEnter);
    map.on("mouseleave", "buildings-dots", onLeave);

    return () => {
      map.off("click", "buildings-dots", onClick);
      map.off("mouseenter", "buildings-dots", onEnter);
      map.off("mouseleave", "buildings-dots", onLeave);
    };
  }, [mapRef, onBuildingId]);

  if (!showMvt) return null;

  return (
    <Source
      key={tilesUrl}
      id="buildings-mvt"
      type="vector"
      tiles={[tilesUrl]}
      minzoom={0}
      maxzoom={MARKER_ZOOM_THRESHOLD - 1}
    >
      <Layer
        id="buildings-dots"
        type="circle"
        source-layer="complexes"
        maxzoom={MARKER_ZOOM_THRESHOLD}
        paint={{
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            3,
            13,
            6,
          ],
          "circle-color": [
            "case",
            ["!", ["has", "score"]],
            "#6b7280",
            ["==", ["get", "score"], null],
            "#6b7280",
            ["==", ["get", "score"], 0],
            "#6b7280",
            [">=", ["get", "score"], 4],
            "#22c55e",
            [">=", ["get", "score"], 3],
            "#eab308",
            [">=", ["get", "score"], 1],
            "#ef4444",
            "#6b7280",
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#000000",
          "circle-stroke-opacity": 0.3,
        }}
      />
    </Source>
  );
}
