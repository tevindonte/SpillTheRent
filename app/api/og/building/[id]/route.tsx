import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildShouldISignSummary } from "@/lib/should-i-sign";

export const runtime = "edge";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VERDICT_COLOR: Record<string, string> = {
  caution: "#ef4444",
  mixed: "#f59e0b",
  ok: "#22c55e",
  unknown: "#a3a3a3",
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("complexes")
    .select(
      "name, address, borough, hpd_open_violations, hpd_violation_score, cached_community_score, google_rating, has_bedbug_history, hp_action_count, oath_violation_count, has_active_construction, is_rent_stabilized"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const detail = {
    id: params.id,
    name: data.name as string,
    address: (data.address as string | null) ?? null,
    borough: (data.borough as string | null) ?? null,
    neighborhood: null,
    zip: null,
    units: null,
    google_rating: data.google_rating as number | null,
    google_review_count: null,
    street_view_url: null,
    google_place_id: null,
    lat: 0,
    lng: 0,
    median_rent: null,
    rent_report_count: 0,
    rent_by_bedroom: {},
    community_rating: null,
    community_review_count: 0,
    spill_score: data.cached_community_score as number | null,
    hpd_open_violations: (data.hpd_open_violations as number) ?? 0,
    hpd_violation_score: (data.hpd_violation_score as string | null) ?? null,
    is_rent_stabilized: (data.is_rent_stabilized as boolean) ?? false,
    stabilized_units: null,
    stabilization_year: null,
    red_flags: [] as string[],
    landlord: null,
    signals: {
      has_bedbug_history: (data.has_bedbug_history as boolean) ?? false,
      bedbug_last_reported_year: null,
      bedbug_report_count: 0,
      has_active_construction: (data.has_active_construction as boolean) ?? false,
      active_permit_count: 0,
      oath_violation_count: (data.oath_violation_count as number) ?? 0,
      hp_action_count: (data.hp_action_count as number) ?? 0,
      hp_action_last_year: null,
    },
  };

  const summary = buildShouldISignSummary(detail);
  const accent = VERDICT_COLOR[summary.verdict] ?? VERDICT_COLOR.unknown;
  const hpd = detail.hpd_open_violations;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 48,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#f97316", fontWeight: 700 }}>
          spillthe.rent
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          {detail.name}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 24, color: "#a3a3a3" }}>
          {detail.address ?? detail.borough ?? "NYC"}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            padding: "20px 28px",
            borderRadius: 16,
            border: `3px solid ${accent}`,
            fontSize: 28,
            fontWeight: 600,
            color: accent,
          }}
        >
          {summary.headline}
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 26, color: "#d4d4d4" }}>
          {hpd > 0
            ? `${hpd} open HPD violation${hpd === 1 ? "" : "s"} · ${detail.hpd_violation_score ?? "on record"}`
            : "No open HPD violations on record"}
        </div>
        {detail.spill_score != null && (
          <div style={{ display: "flex", marginTop: 16, fontSize: 24, color: "#f97316" }}>
            spillthe.rent score {detail.spill_score.toFixed(1)}/5
          </div>
        )}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: 20,
            color: "#737373",
          }}
        >
          Building rap sheet · spillthe.rent
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
