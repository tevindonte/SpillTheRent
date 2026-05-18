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
  const medianRent = complex.cached_median_rent ?? complex.median_rent;
  const rentLabel = formatRent(medianRent);
  const signalHigh = (complex.cached_signal_count ?? 0) > 3;
  const mapScore =
    complex.cached_community_score != null
      ? complex.cached_community_score
      : complex.google_rating;

  const pillIcon = useMemo(
    () => (rentLabel ? createRentPillIcon(rentLabel, selected, signalHigh) : null),
    [rentLabel, selected, signalHigh]
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

  const color = ratingColor(mapScore);

  return (
    <>
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
      {signalHigh && (
        <CircleMarker
          center={[complex.lat, complex.lng]}
          radius={4}
          renderer={renderer}
          pathOptions={{
            color: "#0a0a0a",
            fillColor: "#f97316",
            fillOpacity: 1,
            weight: 1.5,
          }}
          eventHandlers={clickHandlers}
        />
      )}
    </>
  );
}
