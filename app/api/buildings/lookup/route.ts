import { NextRequest, NextResponse } from "next/server";
import { parseCoordinates } from "@/lib/complexes";
import {
  isNycAddress,
  nominatimToBuilding,
  searchNominatim,
} from "@/lib/nominatim";
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

  const { result, error: geoError } = await searchNominatim(query);

  if (geoError) {
    return NextResponse.json({ error: geoError }, { status: 502 });
  }

  if (!result) {
    return NextResponse.json(
      { error: "Address not found, please check and try again" },
      { status: 404 }
    );
  }

  if (!isNycAddress(result.address)) {
    return NextResponse.json(
      { error: "Only NYC addresses supported right now" },
      { status: 422 }
    );
  }

  const building = nominatimToBuilding(result, query);
  if (!Number.isFinite(building.lat) || !Number.isFinite(building.lng)) {
    return NextResponse.json(
      { error: "Address not found, please check and try again" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: "geocode",
    candidate: {
      name: building.name,
      address: building.address,
      street: building.street,
      city: building.city,
      zip: building.zip,
      borough: building.borough,
      lat: building.lat,
      lng: building.lng,
    },
  });
}
