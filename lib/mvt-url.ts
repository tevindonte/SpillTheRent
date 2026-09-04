import type { MapFilters } from "@/lib/complexes";
import type { MapColorMode } from "@/lib/map-color-mode";

/** MapLibre vector tile URL template for complexes MVT layer. */
export function buildMvtTileUrl(
  filters: MapFilters = {},
  mode: MapColorMode = "rating"
): string {
  const params = new URLSearchParams();
  if (filters.boroughArea) params.set("boroughArea", filters.boroughArea);
  if (filters.rentStabilizedOnly) params.set("rentStabilizedOnly", "true");
  if (filters.hasHpdViolations) params.set("hasHpdViolations", "true");
  if (filters.minGoogleRating != null && filters.minGoogleRating > 0) {
    params.set("minGoogleRating", String(filters.minGoogleRating));
  }
  if (mode === "rent") params.set("mode", "rent");
  const qs = params.toString();
  return `/api/complexes/mvt/{z}/{x}/{y}${qs ? `?${qs}` : ""}`;
}
