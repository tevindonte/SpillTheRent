import { NextRequest, NextResponse } from "next/server";
import type { MapFilters } from "@/lib/complexes";
import { parseBoroughAreaParam } from "@/lib/map-boroughs";
import { mapRatingColor } from "@/lib/map-marker-style";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FEATURES = 8000;

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

function parseFilters(searchParams: URLSearchParams): MapFilters {
  const minGoogleRating = parseFloat(searchParams.get("minGoogleRating") ?? "");
  return {
    boroughArea: parseBoroughAreaParam(searchParams.get("boroughArea")),
    rentStabilizedOnly: searchParams.get("rentStabilizedOnly") === "true",
    hasHpdViolations: searchParams.get("hasHpdViolations") === "true",
    minGoogleRating: Number.isFinite(minGoogleRating) ? minGoogleRating : undefined,
  };
}

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

  const rows = (data ?? []).slice(0, MAX_FEATURES);

  const features = rows.map(
    (row: {
      id: string;
      name: string;
      lat: number;
      lng: number;
      cached_community_score: number | null;
      google_rating: number | null;
      cached_median_rent: number | null;
      hpd_open_violations: number | null;
      hpd_violation_score: string | null;
      has_bedbug_history: boolean | null;
      cached_signal_count: number | null;
    }) => {
      const color = mapRatingColor({
        id: row.id,
        name: row.name,
        address: null,
        borough: null,
        zip: null,
        units: null,
        google_rating: row.google_rating,
        google_review_count: null,
        street_view_url: null,
        median_rent: null,
        review_count: 0,
        lat: Number(row.lat),
        lng: Number(row.lng),
        cached_community_score: row.cached_community_score,
        hpd_violation_score: row.hpd_violation_score,
        has_bedbug_history: row.has_bedbug_history ?? false,
      });
      const score =
        row.cached_community_score != null
          ? row.cached_community_score
          : row.google_rating;
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [Number(row.lng), Number(row.lat)],
        },
        properties: {
          id: row.id,
          name: row.name,
          score,
          color,
          median_rent: row.cached_median_rent,
          hpd: row.hpd_open_violations ?? 0,
          hpd_violation_score: row.hpd_violation_score,
          has_bedbug_history: row.has_bedbug_history ?? false,
          signals: row.cached_signal_count ?? 0,
        },
      };
    }
  );

  return NextResponse.json(
    {
      type: "FeatureCollection",
      features,
      truncated: (data?.length ?? 0) > MAX_FEATURES,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
