import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    )
  );

  const supabase = createAdminClient();
  const { data: events, error } = await supabase
    .from("building_events")
    .select(
      "id, complex_id, event_type, title, summary, payload, created_at, complexes ( name, borough, neighborhood )"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (events ?? []).map((row) => {
    const complex = row.complexes as
      | { name: string; borough: string | null; neighborhood: string | null }
      | { name: string; borough: string | null; neighborhood: string | null }[]
      | null;
    const c = Array.isArray(complex) ? complex[0] : complex;
    return {
      id: row.id,
      complex_id: row.complex_id,
      event_type: row.event_type,
      title: row.title,
      summary: row.summary,
      payload: row.payload,
      created_at: row.created_at,
      building_name: c?.name ?? "Building",
      borough: c?.borough ?? null,
      neighborhood: c?.neighborhood ?? null,
    };
  });

  return NextResponse.json({ items });
}
