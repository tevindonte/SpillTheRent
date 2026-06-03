import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_REASONS = new Set([
  "spam",
  "fake",
  "harassment",
  "off_topic",
  "other",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reason, details } = body as Record<string, unknown>;
  if (typeof reason !== "string" || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid flag reason" }, { status: 400 });
  }

  const admin = createAdminClient();
  await ensureProfile(admin, user.id, user.email);

  const { data: review } = await admin
    .from("reviews")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const { error } = await admin.from("review_flags").insert({
    review_id: params.id,
    reporter_user_id: user.id,
    reason,
    details: typeof details === "string" ? details.trim().slice(0, 500) : null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, message: "Already flagged" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Thanks — we'll review this flag." });
}
