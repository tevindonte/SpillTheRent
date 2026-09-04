import { NextRequest, NextResponse } from "next/server";
import type { MapFilters } from "@/lib/complexes";
import { decodeBytea } from "@/lib/decode-bytea";
import type { BoroughArea } from "@/lib/map-boroughs";
import { createAdminClient } from "@/lib/supabase/admin";

function parseFilters(searchParams: URLSearchParams): MapFilters {
  const raw = searchParams.get("boroughArea");
  const boroughArea =
    raw === "all" || raw === "manhattan" || raw === "brooklyn" || raw === "lic"
      ? (raw as BoroughArea)
      : undefined;
  const minGoogleRating = parseFloat(searchParams.get("minGoogleRating") ?? "");
  return {
    boroughArea,
    rentStabilizedOnly: searchParams.get("rentStabilizedOnly") === "true",
    hasHpdViolations: searchParams.get("hasHpdViolations") === "true",
    minGoogleRating: Number.isFinite(minGoogleRating) ? minGoogleRating : undefined,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { z: string; x: string; y: string } }
) {
  const z = parseInt(params.z, 10);
  const x = parseInt(params.x, 10);
  const y = parseInt(params.y, 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: "Invalid tile coordinates" }, { status: 400 });
  }
  if (z < 0 || z > 22) {
    return NextResponse.json({ error: "Zoom out of range" }, { status: 400 });
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("complexes_mvt_tile", {
    z,
    x,
    y,
    p_borough_area: filters.boroughArea ?? null,
    p_rent_stabilized_only: filters.rentStabilizedOnly ?? false,
    p_has_hpd_violations: filters.hasHpdViolations ?? false,
    p_min_google_rating: filters.minGoogleRating ?? null,
  });

  if (error) {
    const hint =
      error.message.includes("complexes_mvt_tile") ||
      error.message.includes("does not exist")
        ? ". Run migration 20260611000001_complexes_mvt.sql"
        : "";
    return NextResponse.json(
      { error: error.message + hint },
      { status: 500 }
    );
  }

  const body = decodeBytea(data);
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.mapbox-vector-tile",
      "Cache-Control": "public, max-age=120",
    },
  });
}
