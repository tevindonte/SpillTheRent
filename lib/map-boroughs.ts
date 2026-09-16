/** Map borough filter areas (UI labels vs DB borough). */
export type BoroughArea = "all" | "manhattan" | "brooklyn" | "queens";

export const BOROUGH_PILLS: { id: BoroughArea; label: string }[] = [
  { id: "all", label: "All" },
  { id: "manhattan", label: "Manhattan" },
  { id: "brooklyn", label: "Brooklyn" },
  { id: "queens", label: "Queens" },
];

/** Fly-to targets: [lat, lng] (MapView converts to lng/lat for MapLibre). */
export const BOROUGH_FLY_TO: Record<
  Exclude<BoroughArea, "all">,
  { center: [number, number]; zoom: number }
> = {
  manhattan: { center: [40.7831, -73.9712], zoom: 13 },
  brooklyn: { center: [40.6782, -73.9442], zoom: 13 },
  // Full Queens (not just LIC)
  queens: { center: [40.7282, -73.7949], zoom: 12 },
};

/** Normalize query/API boroughArea values (`lic` kept as alias → queens). */
export function parseBoroughAreaParam(
  raw: string | null | undefined
): BoroughArea | undefined {
  if (!raw) return undefined;
  if (raw === "all" || raw === "manhattan" || raw === "brooklyn" || raw === "queens") {
    return raw;
  }
  if (raw === "lic") return "queens";
  return undefined;
}

export function boroughAreaLabel(area: BoroughArea | undefined): string | null {
  if (!area || area === "all") return null;
  return BOROUGH_PILLS.find((p) => p.id === area)?.label ?? null;
}

/** Client-side filter when map summary query cannot run (fallback path). */
export function matchesBoroughArea(
  complex: { borough: string | null; neighborhood?: string | null },
  area: BoroughArea | undefined
): boolean {
  if (!area || area === "all") return true;
  const borough = (complex.borough ?? "").trim();
  if (area === "manhattan") return borough === "Manhattan";
  if (area === "brooklyn") return borough === "Brooklyn";
  if (area === "queens") return borough === "Queens";
  return true;
}

/** Apply borough area filter to a Supabase query on complexes_map_summary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyBoroughAreaFilter(query: any, area: BoroughArea | undefined): any {
  if (!area || area === "all") return query;
  if (area === "manhattan") return query.eq("borough", "Manhattan");
  if (area === "brooklyn") return query.eq("borough", "Brooklyn");
  if (area === "queens") return query.eq("borough", "Queens");
  return query;
}
