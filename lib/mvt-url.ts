import type { MapFilters } from "@/lib/complexes";

/** Leaflet vector tile URL template for complexes MVT layer. */
export function buildMvtTileUrl(filters: MapFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.boroughArea) params.set("boroughArea", filters.boroughArea);
  if (filters.rentStabilizedOnly) params.set("rentStabilizedOnly", "true");
  if (filters.hasHpdViolations) params.set("hasHpdViolations", "true");
  if (filters.minGoogleRating != null && filters.minGoogleRating > 0) {
    params.set("minGoogleRating", String(filters.minGoogleRating));
  }
  const qs = params.toString();
  return `/api/complexes/mvt/{z}/{x}/{y}${qs ? `?${qs}` : ""}`;
}
