import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
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
    reviewText,
    redFlags = [],
    redFlagOther = null,
    rent = null,
    bedrooms = null,
    anonymous = true,
  } = body as Record<string, unknown>;

  if (!complexId || typeof complexId !== "string") {
    return NextResponse.json({ error: "Building is required" }, { status: 400 });
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
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
  if (flags.includes("other") && typeof redFlagOther !== "string") {
    return NextResponse.json({ error: "Describe the other issue" }, { status: 400 });
  }

  let rentNum: number | null = null;
  if (rent != null && rent !== "") {
    rentNum = Number(rent);
    if (!Number.isFinite(rentNum) || rentNum < 0) {
      return NextResponse.json({ error: "Invalid rent" }, { status: 400 });
    }
    if (!bedrooms || !VALID_BEDROOMS.has(bedrooms as BedroomOption)) {
      return NextResponse.json(
        { error: "Bedrooms required when reporting rent" },
        { status: 400 }
      );
    }
  }

  const { user } = await getSessionUser();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: complex } = await admin
    .from("complexes")
    .select("id")
    .eq("id", complexId)
    .maybeSingle();
  if (!complex) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  let userId: string | null = null;
  if (user) {
    const profile = await ensureProfile(admin, user.id, user.email);
    userId = profile.id;
  }

  const { error: reviewError } = await admin.from("reviews").insert({
    complex_id: complexId,
    source: "user",
    rating,
    review_text: reviewText.trim(),
    review_date: now,
    red_flags: flags,
    red_flag_other:
      flags.includes("other") && typeof redFlagOther === "string"
        ? redFlagOther.trim()
        : null,
    is_anonymous: Boolean(anonymous),
    user_id: userId,
    rent_amount: rentNum != null ? Math.round(rentNum) : null,
    bedrooms: bedrooms && VALID_BEDROOMS.has(bedrooms as BedroomOption)
      ? (bedrooms as string)
      : null,
  });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  if (rentNum != null && bedrooms) {
    const bedroomInt = bedroomsToInt(bedrooms as BedroomOption);
    await admin.from("pricing_history").insert({
      complex_id: complexId,
      rent: Math.round(rentNum),
      bedrooms: bedroomInt,
      recorded_at: now,
      user_id: userId,
      is_anonymous: Boolean(anonymous),
    });
  }

  return NextResponse.json({ success: true });
}
