import { NextRequest, NextResponse } from "next/server";
import { findPlaceFromText, isResidentialPlace } from "@/lib/google/places";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNIT_COUNT_OPTIONS, type UnitCountOption } from "@/lib/submissions/constants";

const VALID_UNIT_COUNTS = new Set(UNIT_COUNT_OPTIONS.map((o) => o.value));

function unitsFromOption(value: UnitCountOption): number {
  return UNIT_COUNT_OPTIONS.find((o) => o.value === value)?.units ?? 25;
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, unitCount } = body as Record<string, unknown>;

  if (typeof address !== "string" || address.trim().length < 5) {
    return NextResponse.json(
      { error: "Enter a valid Manhattan address" },
      { status: 400 }
    );
  }
  if (!VALID_UNIT_COUNTS.has(unitCount as UnitCountOption)) {
    return NextResponse.json(
      { error: "Select an estimated unit count" },
      { status: 400 }
    );
  }

  const query = `${address.trim()} Manhattan New York`;
  const { candidate, error: googleError } = await findPlaceFromText(query);

  if (googleError) {
    return NextResponse.json({ error: googleError }, { status: 502 });
  }
  if (!candidate?.place_id) {
    return NextResponse.json(
      {
        error:
          "We couldn't find that address on Google Maps. Check the spelling and try again.",
      },
      { status: 422 }
    );
  }

  if (!isResidentialPlace(candidate.types)) {
    return NextResponse.json(
      {
        error:
          "This doesn't look like a residential building. Please submit an apartment or condo address.",
      },
      { status: 422 }
    );
  }

  const formatted = candidate.formatted_address ?? address.trim();
  const displayName = candidate.name?.trim() || formatted;
  const normalized = normalizeAddress(formatted);

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("complexes")
    .select("id")
    .ilike("address", normalized)
    .limit(1);

  if (existing?.length) {
    return NextResponse.json(
      { error: "This building is already in our database." },
      { status: 409 }
    );
  }

  const lat = candidate.geometry?.location?.lat;
  const lng = candidate.geometry?.location?.lng;
  const insertRow: Record<string, unknown> = {
    name: displayName,
    address: formatted,
    borough: "Manhattan",
    units: unitsFromOption(unitCount as UnitCountOption),
    verified: false,
    google_place_id: candidate.place_id,
    portal_type: "unknown",
  };

  if (lat != null && lng != null) {
    insertRow.coordinates = `SRID=4326;POINT(${lng} ${lat})`;
  }

  const { data: created, error: insertError } = await supabase
    .from("complexes")
    .insert(insertRow)
    .select("id")
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to add building" },
      { status: 500 }
    );
  }

  const { error: queueError } = await supabase.from("enrichment_queue").insert({
    complex_id: created.id,
    status: "pending",
  });

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Thanks, we'll verify and add this building soon",
    complexId: created.id,
  });
}
