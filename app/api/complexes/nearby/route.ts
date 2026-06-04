import { NextRequest, NextResponse } from "next/server";
import { isInNycServiceArea } from "@/lib/nyc-service-area";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") ?? "");
  const limit = Math.min(
    5,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "3", 10) || 3)
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }
  if (!isInNycServiceArea(lat, lng)) {
    return NextResponse.json({ buildings: [] });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("complexes_nearest", {
    p_lat: lat,
    p_lng: lng,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ buildings: data ?? [] });
}
