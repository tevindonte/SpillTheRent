"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { ratingColor, type MapFilters } from "@/lib/complexes";
import { buildMvtTileUrl } from "@/lib/mvt-url";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";

type MvtProps = {
  filters: MapFilters;
  zoom: number;
  onBuildingId: (id: string) => void;
};

export function MapMvtLayer({ filters, zoom, onBuildingId }: MvtProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const onBuildingIdRef = useRef(onBuildingId);
  onBuildingIdRef.current = onBuildingId;

  useEffect(() => {
    if (zoom >= MARKER_ZOOM_THRESHOLD) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      await import("leaflet.vectorgrid");
      if (cancelled) return;

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      const url = buildMvtTileUrl(filters);
      // leaflet.vectorgrid extends L at runtime
      const vectorGrid = (
        L as typeof L & {
          vectorGrid: {
            protobuf: (
              u: string,
              opts: Record<string, unknown>
            ) => L.Layer;
          };
        }
      ).vectorGrid.protobuf(url, {
        interactive: true,
        maxNativeZoom: MARKER_ZOOM_THRESHOLD - 1,
        vectorTileLayerStyles: {
          complexes: (props: { score?: number | null }) => ({
            radius: 5,
            fillColor: ratingColor(
              props.score != null ? Number(props.score) : null
            ),
            fillOpacity: 0.9,
            color: "#0a0a0a",
            weight: 1,
            opacity: 1,
          }),
        },
        getFeatureId: (f: { properties: { id: string } }) => f.properties.id,
      });

      vectorGrid.on(
        "click",
        (e: L.LeafletMouseEvent & {
          layer?: { properties?: { id?: string } };
        }) => {
          const id = e.layer?.properties?.id;
          if (id) onBuildingIdRef.current(id);
        }
      );

      vectorGrid.addTo(map);
      layerRef.current = vectorGrid;
    })();

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, filters, zoom]);

  return null;
}
