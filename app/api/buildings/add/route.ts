import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNIT_COUNT_OPTIONS, type UnitCountOption } from "@/lib/submissions/constants";

const VALID_UNIT_COUNTS = new Set(UNIT_COUNT_OPTIONS.map((o) => o.value));

function unitsFromOption(value: UnitCountOption): number {
  return UNIT_COUNT_OPTIONS.find((o) => o.value === value)?.units ?? 25;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const mode = payload.mode as "geocode" | "manual" | "google";

  const admin = createAdminClient();

  // "google" kept as alias for older clients; both use Nominatim-sourced fields.
  if (mode === "geocode" || mode === "google") {
    const { name, address, lat, lng, zip, borough } = payload as {
      name: string;
      address: string;
      lat?: number;
      lng?: number;
      zip?: string | null;
      borough?: string | null;
    };

    if (!address?.trim()) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Missing coordinates. Look up the address again" },
        { status: 400 }
      );
    }

    const insertRow: Record<string, unknown> = {
      name: (name || address).trim(),
      address: address.trim(),
      borough: borough?.trim() || "Manhattan",
      zip: zip?.trim() || null,
      verified: true,
      google_place_id: null,
      google_rating: null,
      google_review_count: null,
      portal_type: "unknown",
      coordinates: `SRID=4326;POINT(${lng} ${lat})`,
    };

    const { data: created, error } = await admin
      .from("complexes")
      .insert(insertRow)
      .select("id, name, address")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: error?.message ?? "Insert failed" },
        { status: 500 }
      );
    }

    await admin.from("enrichment_queue").insert({
      complex_id: created.id,
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      complexId: created.id,
      message: "Building added! Be the first to leave a review.",
    });
  }

  const { address, name, unitCount } = payload as {
    address: string;
    name?: string;
    unitCount: UnitCountOption;
  };

  if (!address?.trim()) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }
  if (!VALID_UNIT_COUNTS.has(unitCount)) {
    return NextResponse.json({ error: "Select unit count" }, { status: 400 });
  }

  const { data: created, error } = await admin
    .from("complexes")
    .insert({
      name: name?.trim() || address.trim(),
      address: address.trim(),
      borough: "Manhattan",
      units: unitsFromOption(unitCount),
      verified: false,
      portal_type: "unknown",
    })
    .select("id, name, address")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    complexId: created.id,
    message: "Building added! Be the first to leave a review.",
  });
}
