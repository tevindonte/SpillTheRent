import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("data_source_freshness")
    .select("source_key, label, last_updated_at")
    .order("label");

  if (error) {
    return NextResponse.json({ sources: [] });
  }

  return NextResponse.json({ sources: data ?? [] });
}
