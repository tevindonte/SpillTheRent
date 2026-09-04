"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import { Marker } from "react-map-gl/maplibre";
import Supercluster from "supercluster";
import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";
import { formatRent } from "@/lib/format";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";
import {
  clusterBubbleSize,
  clusterColorFromScores,
  mapScore,
} from "@/lib/map-marker-style";
import { rentPillHtml } from "@/lib/map-markers";
import { filterValidMapComplexes } from "@/lib/map-coordinates";

type MapLibreMarkersProps = {
  complexes: Complex[];
  zoom: number;
  bounds: { west: number; south: number; east: number; north: number } | null;
  selectedId: string | null;
  onSelect: (complex: Complex) => void;
  onClusterClick: (lng: number, lat: number, expansionZoom: number) => void;
};

type PointProps = Complex;

export function MapLibreMarkers({
  complexes,
  zoom,
  bounds,
  selectedId,
  onSelect,
  onClusterClick,
}: MapLibreMarkersProps) {
  const colorCacheRef = useRef<Map<string, string>>(new Map());

  const visible = useMemo(
    () => filterValidMapComplexes(complexes),
    [complexes]
  );

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({
      radius: 60,
      // Match Leaflet disableClusteringAtZoom=14: no clusters at zoom 14+.
      maxZoom: MARKER_ZOOM_THRESHOLD - 1,
    });

    sc.load(
      visible.map((c) => ({
        type: "Feature" as const,
        properties: c,
        geometry: {
          type: "Point" as const,
          coordinates: [c.lng, c.lat] as [number, number],
        },
      }))
    );
    colorCacheRef.current.clear();
    return sc;
  }, [visible]);

  const clusters = useMemo(() => {
    if (!bounds || zoom < MARKER_ZOOM_THRESHOLD) return [];
    return index.getClusters(
      [bounds.west, bounds.south, bounds.east, bounds.north],
      Math.floor(zoom)
    );
  }, [index, bounds, zoom]);

  if (zoom < MARKER_ZOOM_THRESHOLD || !bounds) return null;

  return (
    <>
      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        if (
          props &&
          typeof props === "object" &&
          "cluster" in props &&
          props.cluster
        ) {
          const clusterId = Number(
            (props as { cluster_id: number }).cluster_id
          );
          const count = Number((props as { point_count: number }).point_count);
          const cacheKey = `${clusterId}:${Math.floor(zoom)}`;
          let color = colorCacheRef.current.get(cacheKey);
          if (!color) {
            const leaves = index.getLeaves(clusterId, 50, 0);
            const scores: number[] = [];
            for (const leaf of leaves) {
              const s = mapScore(leaf.properties);
              if (s != null) scores.push(s);
            }
            color = clusterColorFromScores(scores);
            colorCacheRef.current.set(cacheKey, color);
          }
          const size = clusterBubbleSize(count);
          const expansionZoom = Math.min(
            index.getClusterExpansionZoom(clusterId),
            18
          );

          return (
            <Marker
              key={`cluster-${clusterId}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onClusterClick(lng, lat, expansionZoom);
              }}
            >
              <div
                className="spill-cluster-icon"
                style={{ width: size, height: size }}
              >
                <div
                  className="spill-cluster-bubble"
                  style={
                    {
                      "--cluster-color": color,
                      width: size,
                      height: size,
                    } as CSSProperties
                  }
                >
                  <span>{count}</span>
                </div>
              </div>
            </Marker>
          );
        }

        const complex = props as Complex;
        const selected = selectedId === complex.id;
        const medianRent = complex.cached_median_rent ?? complex.median_rent;
        const rentLabel = formatRent(medianRent);
        const signalHigh = (complex.cached_signal_count ?? 0) > 3;
        const score = mapScore(complex);
        const color = ratingColor(score);

        if (rentLabel) {
          return (
            <Marker
              key={complex.id}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect(complex);
              }}
            >
              <div
                className="rent-pill-marker"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                  __html: rentPillHtml(rentLabel, selected, signalHigh),
                }}
              />
            </Marker>
          );
        }

        return (
          <Marker
            key={complex.id}
            longitude={lng}
            latitude={lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelect(complex);
            }}
          >
            <div className="relative" style={{ width: 14, height: 14 }}>
              <div
                style={{
                  width: selected ? 18 : 14,
                  height: selected ? 18 : 14,
                  borderRadius: 9999,
                  background: color,
                  border: selected
                    ? "2.5px solid #fafafa"
                    : "1.5px solid #0a0a0a",
                  boxShadow: "0 1px 4px rgb(0 0 0 / 0.45)",
                  transform: "translate(-50%, -50%)",
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                }}
              />
              {signalHigh && (
                <span
                  className="rent-pill-marker__signal"
                  aria-hidden
                  style={{ top: -2, right: -2 }}
                />
              )}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
