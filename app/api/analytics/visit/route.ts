import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function POST(request: NextRequest) {
  let body: { visitorId?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const visitorId = (body.visitorId ?? "").trim();
  if (!UUID_RE.test(visitorId)) {
    return NextResponse.json({ error: "Invalid visitorId" }, { status: 400 });
  }

  const pathRaw = typeof body.path === "string" ? body.path : "/";
  const path = pathRaw.slice(0, 200) || "/";

  const supabase = createAdminClient();
  const now = new Date();
  const today = startOfUtcDay(now);

  const { data: existing, error: readErr } = await supabase
    .from("site_visitors")
    .select("id, last_seen_at, visit_days")
    .eq("id", visitorId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  if (!existing) {
    const { error } = await supabase.from("site_visitors").insert({
      id: visitorId,
      first_seen_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      visit_days: 1,
      last_path: path,
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, isNew: true });
  }

  const lastSeen = existing.last_seen_at
    ? new Date(existing.last_seen_at as string)
    : null;
  const alreadyToday = lastSeen != null && lastSeen >= today;

  if (alreadyToday) {
    await supabase
      .from("site_visitors")
      .update({ last_path: path, last_seen_at: now.toISOString() })
      .eq("id", visitorId);
    return NextResponse.json({ ok: true, isNew: false });
  }

  const { error: upErr } = await supabase
    .from("site_visitors")
    .update({
      last_seen_at: now.toISOString(),
      visit_days: (existing.visit_days ?? 1) + 1,
      last_path: path,
    })
    .eq("id", visitorId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, isNew: false });
}
