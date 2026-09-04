import { NextRequest, NextResponse } from "next/server";
import {
  isNycAddress,
  nominatimToBuilding,
  searchNominatim,
} from "@/lib/nominatim";
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
      { error: "Enter a valid NYC address" },
      { status: 400 }
    );
  }
  if (!VALID_UNIT_COUNTS.has(unitCount as UnitCountOption)) {
    return NextResponse.json(
      { error: "Select an estimated unit count" },
      { status: 400 }
    );
  }

  const { result, error: geoError } = await searchNominatim(address.trim());

  if (geoError) {
    return NextResponse.json({ error: geoError }, { status: 502 });
  }
  if (!result) {
    return NextResponse.json(
      { error: "Address not found, please check and try again" },
      { status: 422 }
    );
  }
  if (!isNycAddress(result.address)) {
    return NextResponse.json(
      { error: "Only NYC addresses supported right now" },
      { status: 422 }
    );
  }

  const building = nominatimToBuilding(result, address.trim());
  if (!Number.isFinite(building.lat) || !Number.isFinite(building.lng)) {
    return NextResponse.json(
      { error: "Address not found, please check and try again" },
      { status: 422 }
    );
  }

  const formatted = building.address;
  const displayName = building.name;
  const normalized = normalizeAddress(formatted);

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("complexes")
    .select("id")
    .ilike("address", `%${normalized.slice(0, 40)}%`)
    .limit(1);

  if (existing?.length) {
    return NextResponse.json(
      { error: "This building is already in our database." },
      { status: 409 }
    );
  }

  const insertRow: Record<string, unknown> = {
    name: displayName,
    address: formatted,
    borough: building.borough ?? "Manhattan",
    zip: building.zip,
    units: unitsFromOption(unitCount as UnitCountOption),
    verified: false,
    google_place_id: null,
    portal_type: "unknown",
    coordinates: `SRID=4326;POINT(${building.lng} ${building.lat})`,
  };

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
