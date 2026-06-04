import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Set([
  "https://www.streeteasy.com",
  "https://streeteasy.com",
  "https://www.zillow.com",
  "https://zillow.com",
  "https://www.apartments.com",
  "https://apartments.com",
]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allow = ALLOWED.has(origin) ? origin : "https://www.streeteasy.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function corsJson(request: NextRequest, data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(request) });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return corsJson(request, { error: "Invalid JSON" }, 400);
  }

  const { address, title } = body as { address?: string; title?: string };
  const query = (address || title || "").trim();
  if (query.length < 5) {
    return corsJson(request, { building: null });
  }

  const admin = createAdminClient();
  const escaped = query.replace(/,/g, "").slice(0, 120);
  const pattern = `%${escaped}%`;

  const { data } = await admin
    .from("complexes")
    .select(
      "id, name, address, hpd_open_violations, hpd_violation_score, cached_community_score"
    )
    .or(`address.ilike.${pattern},name.ilike.${pattern}`)
    .not("coordinates", "is", null)
    .limit(1);

  const hit = data?.[0];
  if (!hit) {
    return corsJson(request, { building: null });
  }

  return corsJson(request, {
    building: {
      id: hit.id,
      name: hit.name,
      address: hit.address,
      hpd_open_violations: hit.hpd_open_violations ?? 0,
      hpd_violation_score: hit.hpd_violation_score,
      spill_score: hit.cached_community_score,
    },
  });
}
