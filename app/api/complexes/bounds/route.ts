import { NextRequest, NextResponse } from "next/server";
import type { MapFilters } from "@/lib/complexes";
import type { BoroughArea } from "@/lib/map-boroughs";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ROWS = 8000;

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

function parseBoroughArea(raw: string | null): BoroughArea | null {
  if (
    raw === "all" ||
    raw === "manhattan" ||
    raw === "brooklyn" ||
    raw === "lic"
  ) {
    return raw;
  }
  return null;
}

function parseFilters(searchParams: URLSearchParams): MapFilters {
  const minGoogleRating = parseFloat(searchParams.get("minGoogleRating") ?? "");
  return {
    boroughArea: parseBoroughArea(searchParams.get("boroughArea")) ?? undefined,
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
  hpd_open_violations: number | null;
  is_rent_stabilized: boolean | null;
  cached_median_rent: number | null;
  cached_review_count: number | null;
  cached_community_score: number | null;
  cached_signal_count: number | null;
};

export async function GET(request: NextRequest) {
  const bounds = parseBounds(request.nextUrl.searchParams);
  if (!bounds) {
    return NextResponse.json(
      { error: "south, north, west, and east are required" },
      { status: 400 }
    );
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("complexes_in_bounds", {
    min_lat: bounds.south,
    min_lng: bounds.west,
    max_lat: bounds.north,
    max_lng: bounds.east,
    p_borough_area: filters.boroughArea ?? null,
    p_rent_stabilized_only: filters.rentStabilizedOnly ?? false,
    p_has_hpd_violations: filters.hasHpdViolations ?? false,
    p_min_google_rating: filters.minGoogleRating ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as BoundsRow[];
  const truncated = rows.length > MAX_ROWS;

  const complexes = rows.slice(0, MAX_ROWS).map((row) => ({
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
    median_rent:
      row.cached_median_rent != null
        ? Math.round(Number(row.cached_median_rent))
        : null,
    review_count: row.cached_review_count ?? 0,
    hpd_open_violations: row.hpd_open_violations ?? 0,
    hpd_violation_score: null as string | null,
    is_rent_stabilized: row.is_rent_stabilized ?? false,
    cached_median_rent: row.cached_median_rent,
    cached_review_count: row.cached_review_count ?? 0,
    cached_community_score: row.cached_community_score,
    cached_signal_count: row.cached_signal_count ?? 0,
  }));

  return NextResponse.json({
    complexes,
    truncated,
    count: complexes.length,
  });
}
