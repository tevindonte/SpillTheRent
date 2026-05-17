import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { complexId, suggestedName } = body as {
    complexId?: string;
    suggestedName?: string;
  };

  if (!complexId || !suggestedName?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const name = suggestedName.trim().slice(0, 200);
  const admin = createAdminClient();
  const { user } = await getSessionUser();

  let userId: string | null = null;
  if (user) {
    const profile = await ensureProfile(admin, user.id, user.email);
    userId = profile.id;
  }

  const { data: complex } = await admin
    .from("complexes")
    .select("id, name, google_place_id")
    .eq("id", complexId)
    .maybeSingle();

  if (!complex) {
    return NextResponse.json({ error: "Building not found" }, { status: 404 });
  }

  const hasPlaceId = Boolean(complex.google_place_id);

  if (!hasPlaceId && (!complex.name || complex.name.length < 3)) {
    await admin.from("complexes").update({ name }).eq("id", complexId);
    return NextResponse.json({
      success: true,
      message: "Thanks! Building name updated.",
      applied: true,
    });
  }

  await admin.from("name_change_requests").insert({
    complex_id: complexId,
    user_id: userId,
    suggested_name: name,
    status: "pending",
  });

  return NextResponse.json({
    success: true,
    message: "Thanks! Name submitted for review.",
    applied: false,
  });
}
