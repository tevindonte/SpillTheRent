/** Map borough filter areas (UI labels vs DB borough/neighborhood). */
export type BoroughArea = "all" | "manhattan" | "brooklyn" | "lic";

export const BOROUGH_PILLS: { id: BoroughArea; label: string }[] = [
  { id: "all", label: "All" },
  { id: "manhattan", label: "Manhattan" },
  { id: "brooklyn", label: "Brooklyn" },
  { id: "lic", label: "Long Island City" },
];

export const BOROUGH_FLY_TO: Record<
  Exclude<BoroughArea, "all">,
  { center: [number, number]; zoom: number }
> = {
  manhattan: { center: [40.7831, -73.9712], zoom: 13 },
  brooklyn: { center: [40.6782, -73.9442], zoom: 13 },
  lic: { center: [40.7447, -73.9485], zoom: 14 },
};

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
  if (area === "lic") {
    const hood = (complex.neighborhood ?? "").toUpperCase();
    return borough === "Queens" && hood.includes("LONG ISLAND CITY");
  }
  return true;
}

/** Apply borough area filter to a Supabase query on complexes_map_summary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyBoroughAreaFilter(query: any, area: BoroughArea | undefined): any {
  if (!area || area === "all") return query;
  if (area === "manhattan") return query.eq("borough", "Manhattan");
  if (area === "brooklyn") return query.eq("borough", "Brooklyn");
  if (area === "lic") {
    return query.eq("borough", "Queens").ilike("neighborhood", "%long island city%");
  }
  return query;
}
