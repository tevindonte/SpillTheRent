"use client";

import { useMemo } from "react";
import { CircleMarker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";
import { ComplexMarker } from "./ComplexMarker";

type MapMarkersProps = {
  complexes: Complex[];
  zoom: number;
  selectedId: string | null;
  onSelect: (complex: Complex) => void;
};

export function MapMarkers({
  complexes,
  zoom,
  selectedId,
  onSelect,
}: MapMarkersProps) {
  const canvasRenderer = useMemo(
    () => L.canvas({ padding: 0.5, tolerance: 3 }),
    []
  );

  if (zoom >= MARKER_ZOOM_THRESHOLD) {
    return (
      <>
        {complexes.map((complex) => (
          <ComplexMarker
            key={complex.id}
            complex={complex}
            selected={selectedId === complex.id}
            onSelect={onSelect}
            renderer={canvasRenderer}
          />
        ))}
      </>
    );
  }

  return (
    <MarkerClusterGroup
      chunkedLoading
      chunkInterval={150}
      chunkDelay={30}
      maxClusterRadius={50}
      showCoverageOnHover={false}
      spiderfyOnMaxZoom={false}
      zoomToBoundsOnClick
      removeOutsideVisibleBounds
    >
      {complexes.map((complex) => {
        const color = ratingColor(complex.google_rating);
        const selected = selectedId === complex.id;
        return (
          <CircleMarker
            key={complex.id}
            center={[complex.lat, complex.lng]}
            radius={selected ? 8 : 6}
            renderer={canvasRenderer}
            pathOptions={{
              color: selected ? "#fafafa" : color,
              fillColor: color,
              fillOpacity: 0.9,
              weight: selected ? 2 : 1.5,
              opacity: 0.95,
            }}
            eventHandlers={{
              click: () => onSelect(complex),
            }}
          />
        );
      })}
    </MarkerClusterGroup>
  );
}
