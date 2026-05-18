import { NextRequest, NextResponse } from "next/server";
import type { MapFilters } from "@/lib/complexes";
import type { BoroughArea } from "@/lib/map-boroughs";
import { createAdminClient } from "@/lib/supabase/admin";

const MAP_PERF =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_MAP_PERF === "1";

function parseBounds(searchParams: URLSearchParams) {
  const south = parseFloat(searchParams.get("south") ?? "");
  const north = parseFloat(searchParams.get("north") ?? "");
  const west = parseFloat(searchParams.get("west") ?? "");
  const east = parseFloat(searchParams.get("east") ?? "");
  if (
    !Number.isFinite(south) ||
    !Number.isFinite(north) ||
    !Number.isFinite(west) ||
    !Number.isFinite(east)
  ) {
    return null;
  }
  return { south, north, west, east };
}

function parseBoroughArea(raw: string | null): BoroughArea | undefined {
  if (
    raw === "all" ||
    raw === "manhattan" ||
    raw === "brooklyn" ||
    raw === "lic"
  ) {
    return raw;
  }
  return undefined;
}

function parseFilters(searchParams: URLSearchParams): MapFilters {
  const minGoogleRating = parseFloat(searchParams.get("minGoogleRating") ?? "");
  return {
    boroughArea: parseBoroughArea(searchParams.get("boroughArea")),
    rentStabilizedOnly: searchParams.get("rentStabilizedOnly") === "true",
    hasHpdViolations: searchParams.get("hasHpdViolations") === "true",
    minGoogleRating: Number.isFinite(minGoogleRating) ? minGoogleRating : undefined,
  };
}

export async function GET(request: NextRequest) {
  const t0 = performance.now();
  const traceId = request.headers.get("x-map-trace-id") ?? undefined;

  const bounds = parseBounds(request.nextUrl.searchParams);
  if (!bounds) {
    return NextResponse.json(
      { error: "south, north, west, and east are required" },
      { status: 400 }
    );
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const boroughArea = filters.boroughArea ?? "all";

  const sqlLabel =
    "complexes_in_bounds(min_lat, min_lng, max_lat, max_lng, borough, filters…)";

  try {
    const supabase = createAdminClient();
    const tQuery = performance.now();

    const { data, error } = await supabase.rpc("complexes_in_bounds", {
      min_lat: bounds.south,
      min_lng: bounds.west,
      max_lat: bounds.north,
      max_lng: bounds.east,
      p_borough_area: boroughArea,
      p_rent_stabilized_only: filters.rentStabilizedOnly ?? false,
      p_has_hpd_violations: filters.hasHpdViolations ?? false,
      p_min_google_rating:
        filters.minGoogleRating != null && filters.minGoogleRating > 0
          ? filters.minGoogleRating
          : null,
    });

    const queryMs = Math.round(performance.now() - tQuery);

    if (error) throw error;

    const rows = data ?? [];
    const totalMs = Math.round(performance.now() - t0);

    if (MAP_PERF) {
      console.info("[map-perf] api/bounds", {
        traceId,
        sql: sqlLabel,
        params: { ...bounds, boroughArea, filters },
        queryMs,
        totalMs,
        rowCount: rows.length,
      });
    }

    const res = NextResponse.json({
      complexes: rows,
      _perf: MAP_PERF
        ? { traceId, sql: sqlLabel, queryMs, totalMs, rowCount: rows.length }
        : undefined,
    });
    res.headers.set("Server-Timing", `db;dur=${queryMs}, total;dur=${totalMs}`);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load buildings";
    if (MAP_PERF) {
      console.error("[map-perf] api/bounds error", {
        traceId,
        sql: sqlLabel,
        ms: Math.round(performance.now() - t0),
        message,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
