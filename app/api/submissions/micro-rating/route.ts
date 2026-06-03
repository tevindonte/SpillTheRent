import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

function parseScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export async function POST(request: NextRequest) {
  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { complexId, pests, management, heatHotWater, noise } = body as Record<
    string,
    unknown
  >;

  if (!complexId || typeof complexId !== "string") {
    return NextResponse.json({ error: "Building is required" }, { status: 400 });
  }

  const scores = {
    pests: parseScore(pests),
    management: parseScore(management),
    heat_hot_water: parseScore(heatHotWater),
    noise: parseScore(noise),
  };

  if (!Object.values(scores).some((s) => s != null)) {
    return NextResponse.json(
      { error: "Rate at least one category (1–5)" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  await ensureProfile(admin, user.id, user.email);

  const { error } = await admin.from("building_micro_ratings").upsert(
    {
      complex_id: complexId,
      user_id: user.id,
      pests: scores.pests,
      management: scores.management,
      heat_hot_water: scores.heat_hot_water,
      noise: scores.noise,
    },
    { onConflict: "complex_id,user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
