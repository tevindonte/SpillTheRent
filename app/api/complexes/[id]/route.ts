import { NextRequest, NextResponse } from "next/server";
import { parseCoordinates } from "@/lib/complexes";
import { createAdminClient } from "@/lib/supabase/admin";
import { RED_FLAG_OPTIONS } from "@/lib/submissions/constants";

const FLAG_LABELS = Object.fromEntries(
  RED_FLAG_OPTIONS.map((f) => [f.value, f.label])
) as Record<string, string>;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const supabase = createAdminClient();

  const { data: complex, error: complexError } = await supabase
    .from("complexes")
    .select(
      "id, name, address, borough, zip, units, google_rating, google_review_count, street_view_url, google_place_id, coordinates"
    )
    .eq("id", id)
    .maybeSingle();

  if (complexError || !complex) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const point = parseCoordinates(complex.coordinates);
  const lat = point?.lat ?? 0;
  const lng = point?.lng ?? 0;

  const { data: pricing } = await supabase
    .from("pricing_history")
    .select("rent")
    .eq("complex_id", id)
    .not("rent", "is", null);

  const rents = (pricing ?? [])
    .map((r) => r.rent)
    .filter((r): r is number => r != null)
    .sort((a, b) => a - b);

  const median_rent =
    rents.length === 0
      ? null
      : rents.length % 2 === 0
        ? Math.round((rents[rents.length / 2 - 1] + rents[rents.length / 2]) / 2)
        : rents[Math.floor(rents.length / 2)];

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

  const { data: recent } = await supabase
    .from("reviews")
    .select(
      `
      id, rating, review_text, source, review_date, user_id,
      profiles:user_id ( handle )
    `
    )
    .eq("complex_id", id)
    .order("created_at", { ascending: false })
    .limit(3);

  const reviews = (recent ?? []).map((row) => {
    const profile = row.profiles as { handle?: string } | { handle?: string }[] | null;
    const handle = Array.isArray(profile)
      ? profile[0]?.handle
      : profile?.handle;
    return {
      id: row.id,
      rating: row.rating,
      review_text: row.review_text,
      source: row.source,
      review_date: row.review_date,
      is_anonymous: !row.user_id,
      author_handle: handle ?? null,
    };
  });

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
    red_flags: Array.from(flagSet),
    reviews,
  });
}
