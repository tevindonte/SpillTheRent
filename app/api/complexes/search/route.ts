import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createClient();
  const escaped = q.replace(/,/g, "");
  const pattern = `%${escaped}%`;

  const { data, error } = await supabase
    .from("complexes")
    .select("id, name, address, borough, zip")
    .or(`name.ilike.${pattern},address.ilike.${pattern}`)
    .order("name")
    .limit(12);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
