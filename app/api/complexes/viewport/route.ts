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

async function complexIdsInBounds(
  bounds: { south: number; north: number; west: number; east: number },
  filters: MapFilters
): Promise<string[]> {
  const supabase = createAdminClient();
  const ids: string[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("complexes_map_summary")
      .select("id")
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
    if (error) throw error;
    if (!data?.length) break;

    ids.push(...data.map((row) => row.id));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return ids;
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
    const complexIds = await complexIdsInBounds(bounds, filters);
    const rents = await rentsForComplexIds(complexIds);
    const median_rent = median(rents);

    return NextResponse.json({ median_rent });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load viewport stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
