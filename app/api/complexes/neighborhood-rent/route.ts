import { NextRequest, NextResponse } from "next/server";
import { median } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;
const ID_CHUNK = 150;

function parseBounds(searchParams: URLSearchParams) {
  const south = parseFloat(searchParams.get("south") ?? "");
  const north = parseFloat(searchParams.get("north") ?? "");
  const west = parseFloat(searchParams.get("west") ?? "");
  const east = parseFloat(searchParams.get("east") ?? "");
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const zoom = parseFloat(searchParams.get("zoom") ?? "");
  if (
    !Number.isFinite(south) ||
    !Number.isFinite(north) ||
    !Number.isFinite(west) ||
    !Number.isFinite(east) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { south, north, west, east, lat, lng, zoom };
}

async function complexIdsInBounds(
  bounds: { south: number; north: number; west: number; east: number },
  neighborhood: string
): Promise<string[]> {
  const supabase = createAdminClient();
  const ids: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("complexes_map_summary")
      .select("id")
      .eq("neighborhood", neighborhood)
      .gte("lat", bounds.south)
      .lte("lat", bounds.north)
      .gte("lng", bounds.west)
      .lte("lng", bounds.east)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;
    ids.push(...data.map((r) => r.id as string));
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

/**
 * Neighborhood median rent for the map banner.
 * Label = nearest complex neighborhood to map center.
 * Stats = tenant rent reports for that neighborhood inside the viewport.
 */
export async function GET(request: NextRequest) {
  const parsed = parseBounds(request.nextUrl.searchParams);
  if (!parsed) {
    return NextResponse.json(
      { error: "south, north, west, east, lat, and lng are required" },
      { status: 400 }
    );
  }

  if (Number.isFinite(parsed.zoom) && parsed.zoom < 13) {
    return NextResponse.json({
      neighborhood: null,
      median_rent: null,
      report_count: 0,
    });
  }

  try {
    const supabase = createAdminClient();
    const { data: near, error: nearError } = await supabase.rpc(
      "complex_neighborhood_near",
      { p_lng: parsed.lng, p_lat: parsed.lat }
    );

    if (nearError) {
      // RPC missing until migration applied; soft-fail.
      return NextResponse.json({
        neighborhood: null,
        median_rent: null,
        report_count: 0,
        error: nearError.message,
      });
    }

    const row = Array.isArray(near) ? near[0] : near;
    const neighborhood =
      row && typeof row.neighborhood === "string" ? row.neighborhood : null;

    if (!neighborhood) {
      return NextResponse.json({
        neighborhood: null,
        median_rent: null,
        report_count: 0,
      });
    }

    const ids = await complexIdsInBounds(parsed, neighborhood);
    const rents = await rentsForComplexIds(ids);
    const report_count = rents.length;
    const median_rent = report_count >= 3 ? median(rents) : null;

    return NextResponse.json({
      neighborhood,
      median_rent:
        median_rent != null && Number.isFinite(median_rent)
          ? Math.round(median_rent)
          : null,
      report_count,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load neighborhood rent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
