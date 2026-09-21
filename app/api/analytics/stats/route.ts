import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  displayVisitorCount,
  formatVisitorCount,
  VISITOR_BASELINE,
} from "@/lib/visitor-stats";

export const revalidate = 60;

export async function GET() {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("site_visitors")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tracked = count ?? 0;
  const display = displayVisitorCount(tracked);

  return NextResponse.json({
    tracked,
    baseline: VISITOR_BASELINE,
    visitors: display,
    label: formatVisitorCount(tracked),
  });
}
