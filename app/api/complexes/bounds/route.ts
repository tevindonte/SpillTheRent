import { NextRequest, NextResponse } from "next/server";
import type { MapFilters } from "@/lib/complexes";
import { applyBoroughAreaFilter, type BoroughArea } from "@/lib/map-boroughs";
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

type BoundsRow = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
  units: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  street_view_url: string | null;
  lat: number;
  lng: number;
  hpd_open_violations?: number | null;
  is_rent_stabilized?: boolean | null;
  cached_median_rent?: number | null;
  cached_review_count?: number | null;
  cached_community_score?: number | null;
  cached_signal_count?: number | null;
  median_rent?: number | null;
  review_count?: number | null;
};

function toBoundsRow(row: BoundsRow): BoundsRow {
  const cachedRent = row.cached_median_rent ?? row.median_rent;
  const cachedReviews = row.cached_review_count ?? row.review_count ?? 0;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    borough: row.borough,
    zip: row.zip,
    units: row.units,
    google_rating: row.google_rating,
    google_review_count: row.google_review_count,
    street_view_url: row.street_view_url,
    lat: Number(row.lat),
    lng: Number(row.lng),
    hpd_open_violations: row.hpd_open_violations ?? 0,
    is_rent_stabilized: row.is_rent_stabilized ?? false,
    cached_median_rent: cachedRent != null ? Number(cachedRent) : null,
    cached_review_count: cachedReviews,
    cached_community_score:
      row.cached_community_score != null
        ? Number(row.cached_community_score)
        : null,
    cached_signal_count: row.cached_signal_count ?? 0,
  };
}

/** Fallback when RPC is missing or schema cache is stale (lat/lng box, not PostGIS). */
async function fetchBoundsFallback(
  bounds: { south: number; north: number; west: number; east: number },
  filters: MapFilters
) {
  const supabase = createAdminClient();
  const pageSize = 1000;
  const rows: BoundsRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("complexes_map_summary")
      .select(
        "id, name, address, borough, zip, units, google_rating, google_review_count, street_view_url, lat, lng, median_rent, review_count, hpd_open_violations, is_rent_stabilized"
      )
      .gte("lat", bounds.south)
      .lte("lat", bounds.north)
      .gte("lng", bounds.west)
      .lte("lng", bounds.east);

    query = applyBoroughAreaFilter(query, filters.boroughArea);
    if (filters.rentStabilizedOnly) query = query.eq("is_rent_stabilized", true);
    if (filters.hasHpdViolations) query = query.gt("hpd_open_violations", 0);
    if (filters.minGoogleRating != null && filters.minGoogleRating > 0) {
      query = query.gte("google_rating", filters.minGoogleRating);
    }

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    rows.push(...(data as BoundsRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const { data: cacheRows } = await supabase
    .from("complexes")
    .select(
      "id, cached_median_rent, cached_review_count, cached_community_score, cached_signal_count"
    )
    .in("id", ids);

  const cacheById = new Map((cacheRows ?? []).map((c) => [c.id, c]));

  return rows.map((row) => {
    const cached = cacheById.get(row.id);
    return toBoundsRow({
      ...row,
      cached_median_rent: cached?.cached_median_rent ?? row.median_rent,
      cached_review_count: cached?.cached_review_count ?? row.review_count,
      cached_community_score: cached?.cached_community_score ?? null,
      cached_signal_count: cached?.cached_signal_count ?? 0,
    });
  });
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

    if (error) {
      console.error("[api/bounds] RPC failed, using fallback", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      const fallbackRows = await fetchBoundsFallback(bounds, filters);
      const totalMs = Math.round(performance.now() - t0);

      const res = NextResponse.json({
        complexes: fallbackRows,
        _fallback: true,
        _rpcError: error.message,
        _perf: MAP_PERF
          ? { traceId, sql: "complexes_map_summary (fallback)", queryMs, totalMs, rowCount: fallbackRows.length }
          : undefined,
      });
      res.headers.set("Server-Timing", `db;dur=${queryMs}, total;dur=${totalMs}`);
      return res;
    }

    const rows = (data ?? []).map((row: BoundsRow) => toBoundsRow(row));
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
    const details =
      e && typeof e === "object" && "details" in e
        ? String((e as { details?: string }).details)
        : undefined;
    const hint =
      e && typeof e === "object" && "hint" in e
        ? String((e as { hint?: string }).hint)
        : undefined;
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code?: string }).code)
        : undefined;

    console.error("[api/bounds] error", { message, code, details, hint });

    if (MAP_PERF) {
      console.error("[map-perf] api/bounds error", {
        traceId,
        sql: sqlLabel,
        ms: Math.round(performance.now() - t0),
        message,
      });
    }

    return NextResponse.json(
      {
        error: message,
        code,
        details,
        hint,
        fix: "Run supabase/migrations/20260603000003_bounds_production_fix.sql in the SQL editor, then NOTIFY pgrst reload.",
      },
      { status: 500 }
    );
  }
}
