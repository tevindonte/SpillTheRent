import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BEDROOM_OPTIONS,
  RED_FLAG_OPTIONS,
  type BedroomOption,
  type RedFlagValue,
} from "@/lib/submissions/constants";

const VALID_BEDROOMS = new Set(BEDROOM_OPTIONS.map((o) => o.value));
const VALID_RED_FLAGS = new Set(RED_FLAG_OPTIONS.map((o) => o.value));

function bedroomsToInt(value: BedroomOption): number {
  return BEDROOM_OPTIONS.find((o) => o.value === value)?.bedrooms ?? 0;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    complexId,
    rating,
    rent,
    bedrooms,
    reviewText,
    redFlags = [],
    anonymous = true,
  } = body as Record<string, unknown>;

  if (!complexId || typeof complexId !== "string") {
    return NextResponse.json({ error: "Building is required" }, { status: 400 });
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }
  if (typeof rent !== "number" || rent < 0 || !Number.isFinite(rent)) {
    return NextResponse.json({ error: "Valid rent is required" }, { status: 400 });
  }
  if (!VALID_BEDROOMS.has(bedrooms as BedroomOption)) {
    return NextResponse.json({ error: "Bedroom count is required" }, { status: 400 });
  }
  if (typeof reviewText !== "string" || reviewText.trim().length < 50) {
    return NextResponse.json(
      { error: "Review must be at least 50 characters" },
      { status: 400 }
    );
  }

  const flags = Array.isArray(redFlags) ? redFlags : [];
  for (const flag of flags) {
    if (!VALID_RED_FLAGS.has(flag as RedFlagValue)) {
      return NextResponse.json({ error: "Invalid red flag" }, { status: 400 });
    }
  }

  const supabase = createAdminClient();

  const { data: complex, error: complexError } = await supabase
    .from("complexes")
    .select("id")
    .eq("id", complexId)
    .maybeSingle();

  if (complexError || !complex) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const bedroomInt = bedroomsToInt(bedrooms as BedroomOption);
  const now = new Date().toISOString();

  const { error: reviewError } = await supabase.from("reviews").insert({
    complex_id: complexId,
    source: "user",
    rating,
    review_text: reviewText.trim(),
    review_date: now,
    red_flags: flags,
    is_anonymous: Boolean(anonymous),
  });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  const { error: pricingError } = await supabase.from("pricing_history").insert({
    complex_id: complexId,
    rent: Math.round(rent),
    bedrooms: bedroomInt,
    recorded_at: now,
  });

  if (pricingError) {
    return NextResponse.json({ error: pricingError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
