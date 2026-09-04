"use client";

import { useEffect, useMemo } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { MapFilters } from "@/lib/complexes";
import type { MapColorMode } from "@/lib/map-color-mode";
import {
  MVT_RATING_CIRCLE_COLOR,
  MVT_RENT_CIRCLE_COLOR,
} from "@/lib/map-color-mode";
import { buildMvtTileUrl } from "@/lib/mvt-url";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";
import type { ExpressionSpecification } from "maplibre-gl";

type MapLibreMvtLayerProps = {
  filters: MapFilters;
  zoom: number;
  colorMode: MapColorMode;
  onBuildingId: (id: string) => void;
};

function absoluteMvtTiles(filters: MapFilters, mode: MapColorMode): string {
  const path = buildMvtTileUrl(filters, mode);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function MapLibreMvtLayer({
  filters,
  zoom,
  colorMode,
  onBuildingId,
}: MapLibreMvtLayerProps) {
  const { current: mapRef } = useMap();
  const tilesUrl = useMemo(
    () => absoluteMvtTiles(filters, colorMode),
    [filters, colorMode]
  );
  const showMvt = zoom < MARKER_ZOOM_THRESHOLD;
  const circleColor = (
    colorMode === "rent" ? MVT_RENT_CIRCLE_COLOR : MVT_RATING_CIRCLE_COLOR
  ) as unknown as ExpressionSpecification;

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
          "circle-color": circleColor,
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#000000",
          "circle-stroke-opacity": 0.3,
        }}
      />
    </Source>
  );
}
