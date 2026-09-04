import { NextRequest, NextResponse } from "next/server";
import type { MapFilters } from "@/lib/complexes";
import { median } from "@/lib/format";
import {
  applyBoroughAreaFilter,
  type BoroughArea,
} from "@/lib/map-boroughs";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;
const ID_CHUNK = 150;

type ViewportRow = {
  id: string;
  google_rating: number | null;
  google_review_count: number | null;
  cached_review_count: number | null;
  review_count: number | null;
};

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

function reviewBacked(row: ViewportRow): number {
  return (
    row.cached_review_count ??
    row.google_review_count ??
    row.review_count ??
    0
  );
}

async function rowsInBounds(
  bounds: { south: number; north: number; west: number; east: number },
  filters: MapFilters
): Promise<ViewportRow[]> {
  const supabase = createAdminClient();
  const rows: ViewportRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("complexes_map_summary")
      .select(
        "id, google_rating, google_review_count, cached_review_count, review_count"
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

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      // Older views may lack cached_review_count; fall back.
      if (
        error.code === "42703" ||
        error.message?.toLowerCase().includes("cached_review_count")
      ) {
        let legacy = supabase
          .from("complexes_map_summary")
          .select("id, google_rating, google_review_count, review_count")
          .gte("lat", bounds.south)
          .lte("lat", bounds.north)
          .gte("lng", bounds.west)
          .lte("lng", bounds.east);
        legacy = applyBoroughAreaFilter(legacy, filters.boroughArea);
        const { data: legacyData, error: legacyError } = await legacy.range(
          offset,
          offset + PAGE_SIZE - 1
        );
        if (legacyError) throw legacyError;
        if (!legacyData?.length) break;
        rows.push(
          ...legacyData.map((r) => ({
            id: r.id as string,
            google_rating: r.google_rating as number | null,
            google_review_count: r.google_review_count as number | null,
            cached_review_count: null,
            review_count: r.review_count as number | null,
          }))
        );
        if (legacyData.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
        continue;
      }
      throw error;
    }
    if (!data?.length) break;

    rows.push(...(data as ViewportRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function rentsForComplexIds(complexIds: string[]): Promise<number[]> {
  if (complexIds.length === 0) return [];

  const supabase = createAdminClient();
  const rents: number[] = [];

  for (let i = 0; i < complexIds.length; i += ID_CHUNK) {
    const chunk = complexIds.slice(i, i + ID_CHUNK);
    const { data, error } = await supabase
      .from("pricing_history")
      .select("rent")
      .in("complex_id", chunk)
      .not("rent", "is", null);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.rent != null) rents.push(row.rent);
    }
  }

  return rents;
}

export async function GET(request: NextRequest) {
  const bounds = parseBounds(request.nextUrl.searchParams);
  if (!bounds) {
    return NextResponse.json(
      { error: "south, north, west, and east are required" },
      { status: 400 }
    );
  }

  try {
    const filters = parseFilters(request.nextUrl.searchParams);
    const rows = await rowsInBounds(bounds, filters);
    const complexIds = rows.map((r) => r.id);
    const rents = await rentsForComplexIds(complexIds);
    const median_rent = median(rents);

    const rated: number[] = [];
    let total_reviews = 0;
    for (const row of rows) {
      const reviews = reviewBacked(row);
      total_reviews += reviews;
      if (reviews > 0 && row.google_rating != null) {
        rated.push(row.google_rating);
      }
    }
    const avg_rating =
      rated.length > 0
        ? rated.reduce((a, b) => a + b, 0) / rated.length
        : null;

    return NextResponse.json({
      median_rent,
      building_count: rows.length,
      avg_rating: total_reviews > 0 ? avg_rating : null,
      total_reviews,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load viewport stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
