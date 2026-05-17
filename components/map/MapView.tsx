"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import type { Complex, MapFilters } from "@/lib/complexes";
import {
  MANHATTAN_BOUNDS,
  MANHATTAN_CENTER,
  MANHATTAN_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/lib/map";
import { useViewportComplexes } from "@/hooks/useViewportComplexes";
import { AddBuildingModal } from "./AddBuildingModal";
import { BuildingPanel } from "./BuildingPanel";
import { BottomStatusBar } from "./BottomStatusBar";
import { DebouncedBoundsTracker } from "./DebouncedBoundsTracker";
import { MapFilterPanel } from "./MapFilterPanel";
import { MapMarkers } from "./MapMarkers";
import { RentModal } from "./RentModal";
import { ReviewModal } from "./ReviewModal";
import { MapSearchBar } from "./MapSearchBar";

function FlyToComplex({ complex }: { complex: Complex | null }) {
  const map = useMap();

  useEffect(() => {
    if (!complex) return;
    map.flyTo([complex.lat, complex.lng], Math.max(map.getZoom(), 15), {
      duration: 0.45,
    });
  }, [complex, map]);

  return null;
}

export default function MapView() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<MapFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  const { complexes, loading, error, zoom, loadForBounds } =
    useViewportComplexes(filters);

  const [selectedComplex, setSelectedComplex] = useState<Complex | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rentOpen, setRentOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reviewComplex, setReviewComplex] = useState<Complex | null>(null);
  const [rentComplex, setRentComplex] = useState<Complex | null>(null);

  const handleViewportChange = useCallback(
    (bounds: LatLngBounds, nextZoom: number) => {
      loadForBounds(bounds, nextZoom);
    },
    [loadForBounds]
  );

  const handleSelectComplex = useCallback((complex: Complex) => {
    setSelectedComplex(complex);
  }, []);

  const openReview = useCallback((complex: Complex) => {
    setReviewComplex(complex);
    setReviewOpen(true);
  }, []);

  const openRent = useCallback((complex: Complex) => {
    setRentComplex(complex);
    setRentOpen(true);
  }, []);

  const bumpPanelRefresh = useCallback(() => {
    setPanelRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const buildingId = searchParams.get("building");
    if (!buildingId) return;
    fetch(`/api/complexes/${buildingId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSelectedComplex({
          id: data.id,
          name: data.name,
          address: data.address,
          borough: data.borough,
          zip: data.zip,
          units: data.units,
          google_rating: data.google_rating,
          google_review_count: data.google_review_count,
          street_view_url: data.street_view_url,
          median_rent: data.median_rent,
          review_count: 0,
          lat: data.lat,
          lng: data.lng,
        });
      })
      .catch(() => {});
  }, [searchParams]);

  const handleCreatedBuilding = useCallback(
    async (complexId: string, name: string) => {
      const res = await fetch(`/api/complexes/${complexId}`);
      if (res.ok) {
        const data = await res.json();
        const c: Complex = {
          id: data.id,
          name: data.name,
          address: data.address,
          borough: data.borough,
          zip: data.zip,
          units: data.units,
          google_rating: data.google_rating,
          google_review_count: data.google_review_count,
          street_view_url: data.street_view_url,
          median_rent: data.median_rent,
          review_count: 0,
          lat: data.lat,
          lng: data.lng,
        };
        setSelectedComplex(c);
        openReview(c);
      } else {
        openReview({
          id: complexId,
          name,
          address: null,
          borough: "Manhattan",
          zip: null,
          units: null,
          google_rating: null,
          google_review_count: null,
          street_view_url: null,
          median_rent: null,
          review_count: 0,
          lat: MANHATTAN_CENTER[0],
          lng: MANHATTAN_CENTER[1],
        });
      }
    },
    [openReview]
  );

  const panelOpen = selectedComplex != null;
  const activeFilterCount =
    (filters.rentStabilizedOnly ? 1 : 0) +
    (filters.hasHpdViolations ? 1 : 0) +
    (filters.minGoogleRating && filters.minGoogleRating > 0 ? 1 : 0);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a]">
      <MapContainer
        center={MANHATTAN_CENTER}
        zoom={MANHATTAN_ZOOM}
        className="h-full w-full z-0"
        maxBounds={MANHATTAN_BOUNDS}
        maxBoundsViscosity={1}
        preferCanvas
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
        <DebouncedBoundsTracker onViewportChange={handleViewportChange} />
        <FlyToComplex complex={selectedComplex} />
        <MapMarkers
          complexes={complexes}
          zoom={zoom}
          selectedId={selectedComplex?.id ?? null}
          onSelect={handleSelectComplex}
        />
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col p-4 pb-16">
        <div className="pointer-events-auto flex gap-2">
          <div className="min-w-0 flex-1">
            <MapSearchBar onSelectBuilding={handleSelectComplex} />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex h-11 shrink-0 items-center gap-1 rounded-xl border px-3 text-sm shadow-lg backdrop-blur ${
              activeFilterCount > 0
                ? "border-orange-500/50 bg-orange-950/40 text-orange-400"
                : "border-neutral-700 bg-neutral-900/95 text-neutral-300"
            }`}
          >
            Filter
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-neutral-950">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/95 text-xl text-orange-500 shadow-lg backdrop-blur hover:border-orange-500/50"
            aria-label="Add building"
          >
            +
          </button>
        </div>
      </div>

      <MapFilterPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
      />

      {loading && !panelOpen && (
        <div className="pointer-events-none absolute right-4 top-20 z-[1000] rounded-full border border-neutral-800 bg-neutral-950/90 px-3 py-1.5 text-xs text-neutral-400 backdrop-blur">
          Loading map…
        </div>
      )}

      {panelOpen && selectedComplex && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-[999] bg-black/40 md:hidden"
            onClick={() => setSelectedComplex(null)}
            aria-hidden
          />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 top-auto z-[1000] flex h-[85vh] md:absolute md:inset-y-0 md:right-0 md:left-auto md:bottom-12 md:h-auto md:w-[420px]">
            <BuildingPanel
              complex={selectedComplex}
              refreshKey={panelRefreshKey}
              onClose={() => setSelectedComplex(null)}
              onRateBuilding={openReview}
              onReportRent={openRent}
            />
          </div>
        </>
      )}

      <BottomStatusBar complexes={complexes} />

      <ReviewModal
        open={reviewOpen}
        complex={reviewComplex}
        onClose={() => {
          setReviewOpen(false);
          setReviewComplex(null);
        }}
        onSuccess={bumpPanelRefresh}
      />

      <RentModal
        open={rentOpen}
        complex={rentComplex}
        onClose={() => {
          setRentOpen(false);
          setRentComplex(null);
        }}
        onSuccess={bumpPanelRefresh}
      />

      <AddBuildingModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onExisting={(c) => {
          setSelectedComplex(c);
        }}
        onCreated={handleCreatedBuilding}
      />

      {error && (
        <div className="absolute bottom-16 left-4 z-[1001] max-w-md rounded-lg border border-red-900/50 bg-red-950/90 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
