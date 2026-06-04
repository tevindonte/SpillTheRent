"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import type { Complex, MapFilters } from "@/lib/complexes";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MANHATTAN_CENTER,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/lib/map";
import {
  dismissVisitorCoverageNotice,
  isVisitorCoverageNoticeDismissed,
} from "@/lib/coverage-notice";
import { viewportOverlapsNyc } from "@/lib/nyc-service-area";
import { useUserOutsideNyc } from "@/hooks/useUserOutsideNyc";
import { latLngBoundsToMapBounds } from "@/lib/map-bounds";
import { BoroughFlyTo } from "./BoroughFlyTo";
import { useViewportComplexes } from "@/hooks/useViewportComplexes";
import { useViewportStats } from "@/hooks/useViewportStats";
import { AddBuildingModal } from "./AddBuildingModal";
import { BuildingPanel } from "./BuildingPanel";
import { BottomStatusBar } from "./BottomStatusBar";
import { DebouncedBoundsTracker } from "./DebouncedBoundsTracker";
import { MapFilterPanel } from "./MapFilterPanel";
import { MapMarkers } from "./MapMarkers";
import { RentModal } from "./RentModal";
import { ReviewModal } from "./ReviewModal";
import { MapSearchBar } from "./MapSearchBar";
import { CompareDrawer } from "@/components/compare/CompareDrawer";
import {
  compareIds,
  loadCompareList,
  setCompareList,
  type CompareEntry,
} from "@/lib/compare-buildings";
import {
  compareSearchString,
  parseCompareParam,
} from "@/lib/compare-url";
import { GeoTeaPrompt } from "./GeoTeaPrompt";
import { MapMvtLayer } from "./MapMvtLayer";
import { NycCoverageNotice } from "./NycCoverageNotice";
import { MARKER_ZOOM_THRESHOLD } from "@/lib/map-bounds";

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

function FlyToNyc({
  flyKey,
  onArrived,
}: {
  flyKey: number;
  onArrived?: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (flyKey < 1) return;
    map.once("moveend", () => onArrived?.());
    map.flyTo(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { duration: 0.55 });
  }, [flyKey, map, onArrived]);
  return null;
}

function detailToComplex(data: Record<string, unknown>): Complex {
  return {
    id: data.id as string,
    name: data.name as string,
    address: (data.address as string | null) ?? null,
    borough: (data.borough as string | null) ?? null,
    zip: (data.zip as string | null) ?? null,
    units: (data.units as number | null) ?? null,
    google_rating: (data.google_rating as number | null) ?? null,
    google_review_count: (data.google_review_count as number | null) ?? null,
    street_view_url: (data.street_view_url as string | null) ?? null,
    median_rent: (data.median_rent as number | null) ?? null,
    review_count: (data.community_review_count as number) ?? 0,
    lat: data.lat as number,
    lng: data.lng as number,
    hpd_open_violations: (data.hpd_open_violations as number) ?? 0,
    hpd_violation_score: (data.hpd_violation_score as string | null) ?? null,
    is_rent_stabilized: (data.is_rent_stabilized as boolean) ?? false,
  };
}

export default function MapView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkHandled = useRef<string | null>(null);
  const compareLinkHandled = useRef<string | null>(null);
  const [filters, setFilters] = useState<MapFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  const {
    complexes,
    loading,
    error,
    zoom,
    mvtAvailable,
    loadForBounds,
    noteBoundsDebounced,
  } = useViewportComplexes(filters);
  const { medianRent, fetchStats } = useViewportStats(filters);

  const [selectedComplex, setSelectedComplex] = useState<Complex | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rentOpen, setRentOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareCount, setCompareCount] = useState(0);
  const [viewportOutsideNyc, setViewportOutsideNyc] = useState(false);
  const [visitorNoticeDismissed, setVisitorNoticeDismissed] = useState(true);
  const userOutsideNyc = useUserOutsideNyc();
  const [reviewComplex, setReviewComplex] = useState<Complex | null>(null);
  const [rentComplex, setRentComplex] = useState<Complex | null>(null);

  const syncCompareToUrl = useCallback(
    (entries: CompareEntry[]) => {
      const path = compareSearchString(
        new URLSearchParams(searchParams.toString()),
        compareIds(entries)
      );
      router.replace(path, { scroll: false });
    },
    [router, searchParams]
  );

  const refreshCompareCount = useCallback(() => {
    setCompareCount(loadCompareList().length);
  }, []);

  const handleCompareChange = useCallback(() => {
    const list = loadCompareList();
    refreshCompareCount();
    syncCompareToUrl(list);
  }, [refreshCompareCount, syncCompareToUrl]);

  useEffect(() => {
    refreshCompareCount();
  }, [refreshCompareCount]);

  useEffect(() => {
    const compareRaw = searchParams.get("compare");
    if (!compareRaw) {
      compareLinkHandled.current = null;
      return;
    }
    if (compareLinkHandled.current === compareRaw) return;
    compareLinkHandled.current = compareRaw;

    const ids = parseCompareParam(compareRaw);
    if (!ids.length) return;

    setCompareOpen(true);
    Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/complexes/${id}/detail`);
        if (!res.ok) return null;
        const d = await res.json();
        return {
          id: d.id as string,
          name: d.name as string,
          address: (d.address as string | null) ?? null,
        } satisfies CompareEntry;
      })
    ).then((entries) => {
      const valid = entries.filter(Boolean) as CompareEntry[];
      if (valid.length) {
        setCompareList(valid);
        refreshCompareCount();
      }
    });
  }, [searchParams, refreshCompareCount]);

  const handleViewportChange = useCallback(
    (bounds: LatLngBounds, nextZoom: number) => {
      setViewportOutsideNyc(!viewportOverlapsNyc(latLngBoundsToMapBounds(bounds)));
      noteBoundsDebounced();
      loadForBounds(bounds, nextZoom);
      fetchStats(bounds);
    },
    [loadForBounds, fetchStats, noteBoundsDebounced]
  );

  const [flyNycKey, setFlyNycKey] = useState(0);
  const [boundsRefreshKey, setBoundsRefreshKey] = useState(0);

  useEffect(() => {
    setVisitorNoticeDismissed(isVisitorCoverageNoticeDismissed());
  }, []);

  const handleSelectComplex = useCallback(
    (complex: Complex) => {
      setSelectedComplex(complex);
      router.replace(`/?building=${complex.id}`, { scroll: false });
    },
    [router]
  );

  const handleMvtBuildingId = useCallback(
    (id: string) => {
      fetch(`/api/complexes/${id}/detail`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) handleSelectComplex(detailToComplex(data));
        })
        .catch(() => {});
    },
    [handleSelectComplex]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedComplex(null);
    router.replace("/", { scroll: false });
  }, [router]);

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
    if (!buildingId) {
      deepLinkHandled.current = null;
      return;
    }
    if (deepLinkHandled.current === buildingId) return;
    deepLinkHandled.current = buildingId;

    fetch(`/api/complexes/${buildingId}/detail`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSelectedComplex(detailToComplex(data));
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
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        className="h-full w-full z-0"
        preferCanvas
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
        <DebouncedBoundsTracker
          onViewportChange={handleViewportChange}
          refreshKey={boundsRefreshKey}
        />
        <BoroughFlyTo boroughArea={filters.boroughArea} />
        <FlyToNyc
          flyKey={flyNycKey}
          onArrived={() => setBoundsRefreshKey((k) => k + 1)}
        />
        <FlyToComplex complex={selectedComplex} />
        {mvtAvailable !== false && (
          <MapMvtLayer
            filters={filters}
            zoom={zoom}
            onBuildingId={handleMvtBuildingId}
          />
        )}
        {(zoom >= MARKER_ZOOM_THRESHOLD || mvtAvailable === false) && (
          <MapMarkers
            complexes={complexes}
            zoom={zoom}
            selectedId={selectedComplex?.id ?? null}
            onSelect={handleSelectComplex}
          />
        )}
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
            onClick={() => setCompareOpen(true)}
            className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-neutral-700 bg-neutral-900/95 px-3 text-xs text-neutral-300 shadow-lg backdrop-blur hover:border-orange-500/50"
          >
            Compare
            {compareCount > 0 && (
              <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-neutral-950">
                {compareCount}
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

      <GeoTeaPrompt
        panelOpen={panelOpen}
        onSelectBuilding={handleSelectComplex}
      />

      {!panelOpen &&
        userOutsideNyc === true &&
        !visitorNoticeDismissed && (
          <div className="pointer-events-none absolute left-4 right-4 top-[4.5rem] z-[1000]">
            <NycCoverageNotice
              variant="visitor"
              onFlyToNyc={() => setFlyNycKey((k) => k + 1)}
              onDismiss={() => {
                dismissVisitorCoverageNotice();
                setVisitorNoticeDismissed(true);
              }}
            />
          </div>
        )}

      {!panelOpen &&
        viewportOutsideNyc &&
        (userOutsideNyc !== true || visitorNoticeDismissed) && (
          <div className="pointer-events-none absolute left-4 right-4 top-[4.5rem] z-[1000]">
            <NycCoverageNotice
              variant="viewport"
              onFlyToNyc={() => setFlyNycKey((k) => k + 1)}
            />
          </div>
        )}

      {loading && !panelOpen && (
        <div className="pointer-events-none absolute right-4 top-20 z-[1000] rounded-full border border-neutral-800 bg-neutral-950/90 px-3 py-1.5 text-xs text-neutral-400 backdrop-blur">
          Loading map…
        </div>
      )}

      {panelOpen && selectedComplex && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 z-[999] bg-black/40 md:hidden"
            onClick={handleClosePanel}
            aria-hidden
          />
          <div className="pointer-events-none fixed inset-x-0 bottom-0 top-auto z-[1000] flex h-[85vh] md:absolute md:inset-y-0 md:right-0 md:left-auto md:bottom-12 md:h-auto md:w-[420px]">
            <BuildingPanel
              complex={selectedComplex}
              refreshKey={panelRefreshKey}
              onClose={handleClosePanel}
              onRateBuilding={openReview}
              onReportRent={openRent}
              onCompareChange={handleCompareChange}
            />
          </div>
        </>
      )}

      <BottomStatusBar
        complexes={complexes}
        medianRent={medianRent}
        boroughArea={filters.boroughArea}
      />

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

      <CompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        onListChange={handleCompareChange}
      />

      {error && (
        <div className="absolute bottom-16 left-4 z-[1001] max-w-md rounded-lg border border-red-900/50 bg-red-950/90 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
