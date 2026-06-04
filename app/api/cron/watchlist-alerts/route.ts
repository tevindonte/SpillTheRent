import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWatchlistAlertEmail } from "@/lib/email/watchlist-alert";
import { getSiteOrigin } from "@/lib/seo";
import { isPremiumActive } from "@/lib/stripe";

const LOOKBACK_HOURS = 48;

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();
  const origin = getSiteOrigin();

  const { data: events, error: eventsError } = await supabase
    .from("building_events")
    .select("id, complex_id, title, summary, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }
  if (!events?.length) {
    return NextResponse.json({ ok: true, emails_sent: 0 });
  }

  const { data: saves, error: savesError } = await supabase
    .from("saved_buildings")
    .select("user_id, complex_id");

  if (savesError) {
    return NextResponse.json({ error: savesError.message }, { status: 500 });
  }

  const eventsByComplex = new Map<string, typeof events>();
  for (const ev of events) {
    const list = eventsByComplex.get(ev.complex_id) ?? [];
    list.push(ev);
    eventsByComplex.set(ev.complex_id, list);
  }

  type Pending = {
    user_id: string;
    complex_id: string;
    event_ids: string[];
    events: typeof events;
  };
  const pending: Pending[] = [];

  for (const save of saves ?? []) {
    const complexEvents = eventsByComplex.get(save.complex_id);
    if (!complexEvents?.length) continue;

    const { data: already } = await supabase
      .from("watchlist_alert_sent")
      .select("event_id")
      .eq("user_id", save.user_id)
      .in(
        "event_id",
        complexEvents.map((e) => e.id)
      );

    const sent = new Set((already ?? []).map((r) => r.event_id));
    const fresh = complexEvents.filter((e) => !sent.has(e.id));
    if (!fresh.length) continue;

    pending.push({
      user_id: save.user_id,
      complex_id: save.complex_id,
      event_ids: fresh.map((e) => e.id),
      events: fresh,
    });
  }

  let emailsSent = 0;

  for (const job of pending) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, handle, watchlist_premium_until")
      .eq("id", job.user_id)
      .maybeSingle();

    if (!isPremiumActive(profile?.watchlist_premium_until)) continue;

    const email = profile?.email?.trim();
    if (!email) continue;

    const { data: complex } = await supabase
      .from("complexes")
      .select("name")
      .eq("id", job.complex_id)
      .maybeSingle();

    try {
      await sendWatchlistAlertEmail({
        to: email,
        userName: (profile?.handle as string) ?? "there",
        buildingName: (complex?.name as string) ?? "Saved building",
        buildingUrl: `${origin}/?building=${job.complex_id}`,
        events: job.events.slice(0, 5).map((e) => ({
          title: e.title as string,
          summary: (e.summary as string | null) ?? null,
        })),
      });

      await supabase.from("watchlist_alert_sent").upsert(
        job.event_ids.map((event_id) => ({
          user_id: job.user_id,
          event_id,
        })),
        { onConflict: "user_id,event_id" }
      );

      emailsSent += 1;
    } catch (e) {
      console.error("[watchlist-alerts]", job.user_id, e);
    }
  }

  return NextResponse.json({
    ok: true,
    emails_sent: emailsSent,
    events_in_window: events.length,
  });
}
