import type { Complex, MapFilters } from "@/lib/complexes";
import type { MapBounds } from "@/lib/map-bounds";

type GeoJsonFeature = {
  properties: {
    id: string;
    name: string;
    score: number | null;
    median_rent: number | null;
    hpd: number;
    signals: number;
  };
  geometry: { coordinates: [number, number] };
};

function featureToComplex(f: GeoJsonFeature): Complex {
  const score = f.properties.score;
  return {
    id: f.properties.id,
    name: f.properties.name,
    address: null,
    borough: null,
    zip: null,
    units: null,
    google_rating: score,
    google_review_count: null,
    street_view_url: null,
    median_rent:
      f.properties.median_rent != null
        ? Math.round(Number(f.properties.median_rent))
        : null,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    review_count: 0,
    hpd_open_violations: f.properties.hpd,
    hpd_violation_score: null,
    is_rent_stabilized: false,
    cached_median_rent: f.properties.median_rent,
    cached_community_score: score,
    cached_signal_count: f.properties.signals,
  };
}

function buildParams(bounds: MapBounds, filters: MapFilters): URLSearchParams {
  const params = new URLSearchParams({
    south: String(bounds.south),
    north: String(bounds.north),
    west: String(bounds.west),
    east: String(bounds.east),
  });
  if (filters.boroughArea) params.set("boroughArea", filters.boroughArea);
  if (filters.rentStabilizedOnly) params.set("rentStabilizedOnly", "true");
  if (filters.hasHpdViolations) params.set("hasHpdViolations", "true");
  if (filters.minGoogleRating != null && filters.minGoogleRating > 0) {
    params.set("minGoogleRating", String(filters.minGoogleRating));
  }
  return params;
}

/** Single-request viewport load via PostGIS RPC (GeoJSON). */
export async function fetchComplexesBoundsApi(
  bounds: MapBounds,
  filters: MapFilters = {}
): Promise<Complex[]> {
  const params = buildParams(bounds, filters);
  const res = await fetch(`/api/complexes/geojson?${params}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Map load failed"
    );
  }
  const features = (body.features ?? []) as GeoJsonFeature[];
  return features.map(featureToComplex);
}
