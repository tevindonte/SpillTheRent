import type { Complex, MapFilters } from "@/lib/complexes";
import type { MapBounds } from "@/lib/map-bounds";

export async function fetchComplexesBoundsApi(
  bounds: MapBounds,
  filters: MapFilters = {}
): Promise<Complex[]> {
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

  const res = await fetch(`/api/complexes/bounds?${params}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Bounds API failed"
    );
  }
  return (body.complexes ?? []) as Complex[];
}
