"use client";

import { useMemo } from "react";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import type { Complex } from "@/lib/complexes";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";
import { filterValidMapComplexes } from "@/lib/map-coordinates";
import { createScoreClusterIcon } from "@/lib/map-marker-style";
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
  const visible = useMemo(
    () => filterValidMapComplexes(complexes),
    [complexes]
  );

  const canvasRenderer = useMemo(
    () => L.canvas({ padding: 0.5, tolerance: 3 }),
    []
  );

  const iconCreateFunction = useMemo(
    () => (cluster: Parameters<typeof createScoreClusterIcon>[0]) =>
      createScoreClusterIcon(cluster),
    []
  );

  return (
    <MarkerClusterGroup
      chunkedLoading
      chunkInterval={200}
      maxClusterRadius={55}
      disableClusteringAtZoom={MARKER_ZOOM_THRESHOLD}
      showCoverageOnHover={false}
      spiderfyOnMaxZoom={false}
      zoomToBoundsOnClick
      removeOutsideVisibleBounds={false}
      iconCreateFunction={iconCreateFunction}
    >
      {visible.map((complex) => (
        <ComplexMarker
          key={complex.id}
          complex={complex}
          zoom={zoom}
          selected={selectedId === complex.id}
          onSelect={onSelect}
          renderer={canvasRenderer}
        />
      ))}
    </MarkerClusterGroup>
  );
}
