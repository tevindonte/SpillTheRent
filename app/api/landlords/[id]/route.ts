import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const supabase = createAdminClient();

  const { data: landlord, error } = await supabase
    .from("landlords")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !landlord) {
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  const { data: buildings } = await supabase
    .from("complexes")
    .select(
      "id, name, address, zip, units, google_rating, google_review_count, hpd_violation_score, hpd_open_violations, coordinates"
    )
    .eq("landlord_id", id)
    .order("name");

  const buildingIds = (buildings ?? []).map((b) => b.id);

  let portfolioReviews: unknown[] = [];
  if (buildingIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select(
        `
        id, rating, review_text, review_date, created_at, complex_id, user_id,
        complexes ( name ),
        profiles:user_id ( handle )
      `
      )
      .in("complex_id", buildingIds)
      .eq("source", "user")
      .order("created_at", { ascending: false })
      .limit(50);

    portfolioReviews = (reviews ?? []).map((row) => {
      const complex = row.complexes as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(complex) ? complex[0]?.name : complex?.name;
      const profile = row.profiles as { handle?: string } | { handle?: string }[] | null;
      const handle = Array.isArray(profile)
        ? profile[0]?.handle
        : profile?.handle;
      return {
        id: row.id,
        rating: row.rating,
        review_text: row.review_text,
        review_date: row.review_date ?? row.created_at,
        building_name: name,
        complex_id: row.complex_id,
        is_anonymous: !row.user_id,
        author_handle: handle ?? null,
      };
    });
  }

  return NextResponse.json({
    landlord,
    buildings: buildings ?? [],
    portfolio_reviews: portfolioReviews,
  });
}
