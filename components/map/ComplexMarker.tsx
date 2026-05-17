"use client";

import { useMemo } from "react";
import { CircleMarker, Marker } from "react-leaflet";
import type { Renderer } from "leaflet";
import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";
import { formatRent } from "@/lib/format";
import { createRentPillIcon } from "@/lib/map-markers";

type ComplexMarkerProps = {
  complex: Complex;
  selected?: boolean;
  onSelect: (complex: Complex) => void;
  renderer?: Renderer;
};

export function ComplexMarker({
  complex,
  selected = false,
  onSelect,
  renderer,
}: ComplexMarkerProps) {
  const rentLabel = formatRent(complex.median_rent);
  const pillIcon = useMemo(
    () => (rentLabel ? createRentPillIcon(rentLabel, selected) : null),
    [rentLabel, selected]
  );

  const clickHandlers = useMemo(
    () => ({
      click: () => onSelect(complex),
    }),
    [complex, onSelect]
  );

  if (pillIcon) {
    return (
      <Marker
        position={[complex.lat, complex.lng]}
        icon={pillIcon}
        eventHandlers={clickHandlers}
        zIndexOffset={selected ? 1000 : 0}
      />
    );
  }

  const color = ratingColor(complex.google_rating);

  return (
    <CircleMarker
      center={[complex.lat, complex.lng]}
      radius={selected ? 9 : 7}
      renderer={renderer}
      pathOptions={{
        color: selected ? "#fafafa" : color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: selected ? 2.5 : 1.5,
        opacity: 0.95,
      }}
      eventHandlers={clickHandlers}
    />
  );
}
