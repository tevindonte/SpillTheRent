import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { boroughDbMatch, boroughLabel, type BoroughSlug } from "@/lib/neighborhoods";

export async function GET(
  _request: NextRequest,
  { params }: { params: { borough: string; slug: string } }
) {
  const borough = params.borough as BoroughSlug;
  const slug = params.slug;
  const dbBoroughs = boroughDbMatch(borough);
  if (!dbBoroughs.length) {
    return NextResponse.json({ error: "Unknown borough" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data: complexes, error } = await supabase
    .from("complexes")
    .select("id, name, neighborhood, cached_community_score, cached_review_count")
    .in("borough", dbBoroughs);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalizedSlug = slug.toLowerCase();
  const matched = (complexes ?? []).filter((c) => {
    const hood = (c.neighborhood ?? "").toLowerCase().replace(/\s+/g, "-");
    return hood === normalizedSlug || hood.includes(normalizedSlug);
  });

  if (!matched.length) {
    return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  }

  const name =
    matched[0].neighborhood ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return NextResponse.json({
    borough,
    borough_label: boroughLabel(borough),
    slug,
    name,
    building_count: matched.length,
    total_reviews: matched.reduce(
      (sum, c) => sum + (c.cached_review_count ?? 0),
      0
    ),
    sample_buildings: matched.slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      spill_score: c.cached_community_score,
    })),
  });
}
