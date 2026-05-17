import { NextRequest, NextResponse } from "next/server";
import { parseCoordinates } from "@/lib/complexes";
import { createAdminClient } from "@/lib/supabase/admin";
import { RED_FLAG_OPTIONS } from "@/lib/submissions/constants";

const FLAG_LABELS = Object.fromEntries(
  RED_FLAG_OPTIONS.map((f) => [f.value, f.label])
) as Record<string, string>;

const BEDROOM_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1BR",
  2: "2BR",
  3: "3BR",
  4: "4BR+",
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const supabase = createAdminClient();

  const { data: complex, error } = await supabase
    .from("complexes")
    .select(
      `id, name, address, borough, zip, units, google_rating, google_review_count,
       street_view_url, google_place_id, coordinates,
       hpd_open_violations, hpd_violation_score, is_rent_stabilized,
       stabilized_units, stabilization_year, landlord_id,
       has_bedbug_history, bedbug_last_reported_year, bedbug_report_count,
       has_active_construction, active_permit_count, oath_violation_count,
       hp_action_count, hp_action_last_year`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !complex) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const point = parseCoordinates(complex.coordinates);
  const lat = point?.lat ?? 0;
  const lng = point?.lng ?? 0;

  const { data: pricing } = await supabase
    .from("pricing_history")
    .select("rent, bedrooms")
    .eq("complex_id", id)
    .not("rent", "is", null);

  const allRents = (pricing ?? [])
    .map((r) => r.rent)
    .filter((r): r is number => r != null);
  const median_rent = median(allRents);

  const rentByBedroom: Record<string, number | null> = {};
  const byBed = new Map<number, number[]>();
  for (const row of pricing ?? []) {
    if (row.rent == null || row.bedrooms == null) continue;
    const b = row.bedrooms;
    if (!byBed.has(b)) byBed.set(b, []);
    byBed.get(b)!.push(row.rent);
  }
  for (const [bed, rents] of Array.from(byBed.entries())) {
    const label = BEDROOM_LABELS[bed] ?? `${bed}BR`;
    rentByBedroom[label] = median(rents);
  }

  const { data: userReviews } = await supabase
    .from("reviews")
    .select("rating, red_flags, red_flag_other")
    .eq("complex_id", id)
    .eq("source", "user");

  const communityRatings = (userReviews ?? [])
    .map((r) => r.rating)
    .filter((r): r is number => r != null);
  const community_rating =
    communityRatings.length > 0
      ? communityRatings.reduce((a, b) => a + b, 0) / communityRatings.length
      : null;
  const community_review_count = communityRatings.length;

  const { data: allReviews } = await supabase
    .from("reviews")
    .select("red_flags, red_flag_other")
    .eq("complex_id", id);

  const flagSet = new Set<string>();
  for (const review of allReviews ?? []) {
    for (const flag of review.red_flags ?? []) {
      flagSet.add(FLAG_LABELS[flag] ?? flag);
    }
    if (review.red_flag_other) {
      flagSet.add(review.red_flag_other);
    }
  }

  let landlord = null;
  if (complex.landlord_id) {
    const { data: ll } = await supabase
      .from("landlords")
      .select(
        "id, name, portfolio_score, building_count, total_units, avg_google_rating, avg_hpd_violations"
      )
      .eq("id", complex.landlord_id)
      .maybeSingle();
    landlord = ll;
  }

  return NextResponse.json({
    id: complex.id,
    name: complex.name,
    address: complex.address,
    borough: complex.borough,
    zip: complex.zip,
    units: complex.units,
    google_rating: complex.google_rating,
    google_review_count: complex.google_review_count,
    street_view_url: complex.street_view_url,
    google_place_id: complex.google_place_id,
    lat,
    lng,
    median_rent,
    rent_by_bedroom: rentByBedroom,
    community_rating,
    community_review_count,
    hpd_open_violations: complex.hpd_open_violations ?? 0,
    hpd_violation_score: complex.hpd_violation_score,
    is_rent_stabilized: complex.is_rent_stabilized ?? false,
    stabilized_units: complex.stabilized_units,
    stabilization_year: complex.stabilization_year,
    red_flags: Array.from(flagSet),
    landlord,
    signals: {
      has_bedbug_history: complex.has_bedbug_history ?? false,
      bedbug_last_reported_year: complex.bedbug_last_reported_year,
      bedbug_report_count: complex.bedbug_report_count ?? 0,
      has_active_construction: complex.has_active_construction ?? false,
      active_permit_count: complex.active_permit_count ?? 0,
      oath_violation_count: complex.oath_violation_count ?? 0,
      hp_action_count: complex.hp_action_count ?? 0,
      hp_action_last_year: complex.hp_action_last_year,
    },
  });
}
