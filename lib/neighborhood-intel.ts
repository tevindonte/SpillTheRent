import { createAdminClient } from "@/lib/supabase/admin";
import { boroughDbMatch, type BoroughSlug } from "@/lib/neighborhoods";

export type NeighborhoodIntel = {
  name: string;
  building_count: number;
  total_reviews: number;
  median_rent: number | null;
  avg_hpd_open: number;
  top_red_flags: { flag: string; count: number }[];
  worst_landlords: {
    id: string;
    name: string;
    building_count: number;
    total_hpd: number;
  }[];
  recent_events: {
    id: string;
    complex_id: string;
    building_name: string;
    event_type: string;
    title: string;
    summary: string | null;
    created_at: string;
  }[];
  buildings: {
    id: string;
    name: string;
    cached_community_score: number | null;
    cached_review_count: number | null;
    hpd_open_violations: number | null;
  }[];
};

function normalizeNeighborhoodSlug(name: string | null): string {
  return (name ?? "").toLowerCase().replace(/\s+/g, "-");
}

export async function loadNeighborhoodIntel(
  borough: BoroughSlug,
  slug: string
): Promise<NeighborhoodIntel | null> {
  const supabase = createAdminClient();
  const normalizedSlug = slug.toLowerCase();

  const { data: complexes } = await supabase
    .from("complexes")
    .select(
      "id, name, neighborhood, landlord_id, cached_community_score, cached_review_count, hpd_open_violations, cached_median_rent"
    )
    .in("borough", boroughDbMatch(borough));

  const matched = (complexes ?? []).filter((c) => {
    const hood = normalizeNeighborhoodSlug(c.neighborhood as string | null);
    return hood === normalizedSlug || hood.includes(normalizedSlug);
  });

  if (!matched.length) return null;

  const name =
    matched[0].neighborhood ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const complexIds = matched.map((c) => c.id as string);

  const rents = matched
    .map((c) => c.cached_median_rent as number | null)
    .filter((r): r is number => r != null && Number.isFinite(r));
  rents.sort((a, b) => a - b);
  const median_rent =
    rents.length > 0 ? rents[Math.floor(rents.length / 2)] : null;

  const hpdVals = matched.map((c) => (c.hpd_open_violations as number) ?? 0);
  const avg_hpd_open =
    hpdVals.reduce((a, b) => a + b, 0) / Math.max(hpdVals.length, 1);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("red_flags")
    .in("complex_id", complexIds)
    .eq("source", "user");

  const flagCounts = new Map<string, number>();
  for (const row of reviews ?? []) {
    for (const flag of (row.red_flags as string[]) ?? []) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }
  const top_red_flags = Array.from(flagCounts.entries())
    .map(([flag, count]) => ({ flag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const landlordIdSet = new Set<string>();
  for (const c of matched) {
    const id = c.landlord_id as string | null;
    if (id) landlordIdSet.add(id);
  }
  const landlordIds = Array.from(landlordIdSet);

  let worst_landlords: NeighborhoodIntel["worst_landlords"] = [];
  if (landlordIds.length) {
    const { data: landlords } = await supabase
      .from("landlords")
      .select("id, name")
      .in("id", landlordIds.slice(0, 40));

    worst_landlords = (landlords ?? [])
      .map((l) => {
        const buildings = matched.filter((c) => c.landlord_id === l.id);
        const total_hpd = buildings.reduce(
          (s, c) => s + ((c.hpd_open_violations as number) ?? 0),
          0
        );
        return {
          id: l.id as string,
          name: l.name as string,
          building_count: buildings.length,
          total_hpd,
        };
      })
      .sort((a, b) => b.total_hpd - a.total_hpd)
      .slice(0, 5);
  }

  let recent_events: NeighborhoodIntel["recent_events"] = [];
  const { data: events } = await supabase
    .from("building_events")
    .select("id, complex_id, event_type, title, summary, created_at")
    .in("complex_id", complexIds)
    .order("created_at", { ascending: false })
    .limit(8);

  if (events?.length) {
    const nameById = new Map(matched.map((c) => [c.id, c.name as string]));
    recent_events = events.map((e) => ({
      id: e.id as string,
      complex_id: e.complex_id as string,
      building_name: nameById.get(e.complex_id as string) ?? "Building",
      event_type: e.event_type as string,
      title: e.title as string,
      summary: (e.summary as string | null) ?? null,
      created_at: e.created_at as string,
    }));
  }

  return {
    name,
    building_count: matched.length,
    total_reviews: matched.reduce(
      (s, c) => s + ((c.cached_review_count as number) ?? 0),
      0
    ),
    median_rent,
    avg_hpd_open: Math.round(avg_hpd_open * 10) / 10,
    top_red_flags,
    worst_landlords,
    recent_events,
    buildings: matched
      .sort(
        (a, b) =>
          ((b.hpd_open_violations as number) ?? 0) -
          ((a.hpd_open_violations as number) ?? 0)
      )
      .slice(0, 24)
      .map((b) => ({
        id: b.id as string,
        name: b.name as string,
        cached_community_score: b.cached_community_score as number | null,
        cached_review_count: b.cached_review_count as number | null,
        hpd_open_violations: b.hpd_open_violations as number | null,
      })),
  };
}
