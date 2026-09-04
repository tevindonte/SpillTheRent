import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSubmissionRateLimit } from "@/lib/rate-limit";
import {
  BEDROOM_OPTIONS,
  MOVE_IN_YEAR_START,
  type BedroomOption,
} from "@/lib/submissions/constants";

const VALID_BEDROOMS = new Set(BEDROOM_OPTIONS.map((o) => o.value));

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
    rent,
    bedrooms,
    moveInYear,
    moveOutYear = null,
    anonymous = true,
    unitNumber = null,
  } = body as Record<string, unknown>;

  if (!complexId || typeof complexId !== "string") {
    return NextResponse.json({ error: "Building is required" }, { status: 400 });
  }
  if (typeof rent !== "number" || rent < 0 || !Number.isFinite(rent)) {
    return NextResponse.json({ error: "Valid rent is required" }, { status: 400 });
  }
  if (!VALID_BEDROOMS.has(bedrooms as BedroomOption)) {
    return NextResponse.json({ error: "Bedroom count is required" }, { status: 400 });
  }
  const moveIn = Number(moveInYear);
  if (!Number.isInteger(moveIn) || moveIn < MOVE_IN_YEAR_START) {
    return NextResponse.json({ error: "Invalid move-in year" }, { status: 400 });
  }

  const unit =
    typeof unitNumber === "string" && unitNumber.trim()
      ? unitNumber.trim().slice(0, 32)
      : null;

  const admin = createAdminClient();
  const { user } = await getSessionUser();
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

    const limited = await assertSubmissionRateLimit(admin, userId, "rent");
    if (!limited.ok) {
      return NextResponse.json({ error: limited.message }, { status: 429 });
    }

    await admin.from("rental_history").insert({
      user_id: userId,
      complex_id: complexId,
      move_in_year: moveIn,
      move_out_year: moveOutYear != null ? Number(moveOutYear) : null,
      monthly_rent: Math.round(rent),
      bedrooms: bedrooms as string,
      is_public: !Boolean(anonymous),
    });
  }

  const pricingRow = {
    complex_id: complexId,
    rent: Math.round(rent),
    bedrooms: bedroomsToInt(bedrooms as BedroomOption),
    recorded_at: now,
    user_id: userId,
    is_anonymous: Boolean(anonymous),
    unit_number: unit,
  };

  let { error: pricingError } = await admin
    .from("pricing_history")
    .insert(pricingRow);

  // Column may be missing until migration 20260614000001 is applied.
  if (
    pricingError &&
    unit &&
    (pricingError.message?.includes("unit_number") ||
      pricingError.code === "PGRST204" ||
      pricingError.code === "42703")
  ) {
    const withoutUnit = { ...pricingRow };
    delete (withoutUnit as { unit_number?: string | null }).unit_number;
    ({ error: pricingError } = await admin
      .from("pricing_history")
      .insert(withoutUnit));
  }

  if (pricingError) {
    return NextResponse.json({ error: pricingError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
