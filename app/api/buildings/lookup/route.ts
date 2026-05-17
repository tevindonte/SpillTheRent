import { NextRequest, NextResponse } from "next/server";
import { findPlaceFromText, isResidentialPlace } from "@/lib/google/places";
import { parseCoordinates } from "@/lib/complexes";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { address } = body as { address?: string };
  if (!address?.trim() || address.trim().length < 5) {
    return NextResponse.json({ error: "Enter a valid address" }, { status: 400 });
  }

  const query = address.trim();
  const admin = createAdminClient();

  const { data: matches } = await admin
    .from("complexes")
    .select(
      "id, name, address, borough, zip, units, google_rating, google_review_count, street_view_url, coordinates"
    )
    .or(`address.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(5);

  if (matches?.length) {
    const row = matches[0];
    const point = parseCoordinates(row.coordinates);
    return NextResponse.json({
      status: "exists",
      complex: {
        id: row.id,
        name: row.name,
        address: row.address,
        borough: row.borough,
        zip: row.zip,
        units: row.units,
        google_rating: row.google_rating,
        google_review_count: row.google_review_count,
        street_view_url: row.street_view_url,
        lat: point?.lat ?? 0,
        lng: point?.lng ?? 0,
        median_rent: null,
        review_count: 0,
      },
    });
  }

  const googleQuery = `${query} Manhattan New York`;
  const { candidate, error: googleError } = await findPlaceFromText(googleQuery);

  if (googleError) {
    return NextResponse.json({ error: googleError }, { status: 502 });
  }

  if (candidate?.place_id && isResidentialPlace(candidate.types)) {
    return NextResponse.json({
      status: "google",
      candidate: {
        placeId: candidate.place_id,
        name: candidate.name ?? candidate.formatted_address ?? query,
        address: candidate.formatted_address ?? query,
        lat: candidate.geometry?.location?.lat,
        lng: candidate.geometry?.location?.lng,
      },
    });
  }

  return NextResponse.json({
    status: "manual",
    address: query,
  });
}
