import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BoroughArea } from "@/lib/map-boroughs";

function parseBoroughArea(raw: string | null): BoroughArea {
  if (raw === "manhattan" || raw === "brooklyn" || raw === "lic") return raw;
  return "all";
}

function buildingScore(row: {
  hpd_open_violations: number | null;
  hp_action_count: number | null;
  bedbug_report_count: number | null;
  oath_violation_count: number | null;
}): number {
  return (
    (row.hpd_open_violations ?? 0) * 3 +
    (row.hp_action_count ?? 0) * 5 +
    (row.bedbug_report_count ?? 0) * 2 +
    (row.oath_violation_count ?? 0) * 2
  );
}

function matchesBorough(borough: string | null, neighborhood: string | null, area: BoroughArea): boolean {
  if (area === "all") return true;
  if (area === "manhattan") return borough === "Manhattan";
  if (area === "brooklyn") return borough === "Brooklyn";
  if (area === "lic") {
    return borough === "Queens" && (neighborhood ?? "").toLowerCase().includes("long island city");
  }
  return true;
}

export async function GET(request: NextRequest) {
  const boroughArea = parseBoroughArea(request.nextUrl.searchParams.get("boroughArea"));
  const supabase = createAdminClient();

  const { data: landlords, error: landlordError } = await supabase
    .from("landlords")
    .select("id, name, building_count, total_units, portfolio_score");

  if (landlordError) {
    return NextResponse.json({ error: landlordError.message }, { status: 500 });
  }

  const { data: complexes, error: complexError } = await supabase
    .from("complexes")
    .select(
      "id, name, borough, neighborhood, landlord_id, hpd_open_violations, hp_action_count, bedbug_report_count, oath_violation_count"
    )
    .not("landlord_id", "is", null);

  if (complexError) {
    return NextResponse.json({ error: complexError.message }, { status: 500 });
  }

  type Agg = {
    landlord_id: string;
    total_hpd: number;
    total_hp: number;
    total_bedbugs: number;
    total_oath: number;
    building_count: number;
    worst_building: { id: string; name: string; score: number } | null;
    portfolio_score_sum: number;
  };

  const byLandlord = new Map<string, Agg>();

  for (const c of complexes ?? []) {
    if (!c.landlord_id) continue;
    if (!matchesBorough(c.borough, c.neighborhood, boroughArea)) continue;

    const score = buildingScore(c);
    let agg = byLandlord.get(c.landlord_id);
    if (!agg) {
      agg = {
        landlord_id: c.landlord_id,
        total_hpd: 0,
        total_hp: 0,
        total_bedbugs: 0,
        total_oath: 0,
        building_count: 0,
        worst_building: null,
        portfolio_score_sum: 0,
      };
      byLandlord.set(c.landlord_id, agg);
    }

    agg.total_hpd += c.hpd_open_violations ?? 0;
    agg.total_hp += c.hp_action_count ?? 0;
    agg.total_bedbugs += c.bedbug_report_count ?? 0;
    agg.total_oath += c.oath_violation_count ?? 0;
    agg.building_count += 1;
    agg.portfolio_score_sum += score;

    if (!agg.worst_building || score > agg.worst_building.score) {
      agg.worst_building = { id: c.id, name: c.name, score };
    }
  }

  const landlordMap = new Map((landlords ?? []).map((l) => [l.id, l]));

  const ranked = Array.from(byLandlord.values())
    .map((agg) => {
      const l = landlordMap.get(agg.landlord_id);
      if (!l) return null;
      return {
        id: l.id,
        name: l.name,
        building_count: agg.building_count,
        total_units: l.total_units,
        total_hpd: agg.total_hpd,
        total_hp: agg.total_hp,
        total_bedbugs: agg.total_bedbugs,
        total_oath: agg.total_oath,
        worst_building: agg.worst_building,
        portfolio_score: l.portfolio_score,
        score: agg.portfolio_score_sum,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return NextResponse.json({ landlords: ranked, boroughArea });
}
