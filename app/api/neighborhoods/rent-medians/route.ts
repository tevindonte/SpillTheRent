import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

/**
 * Average cached_median_rent per neighborhood (for By Rent map coloring).
 * Keys are neighborhood names; values are rounded dollar amounts.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const sums = new Map<string, { sum: number; count: number }>();
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("complexes")
        .select("neighborhood, cached_median_rent")
        .not("neighborhood", "is", null)
        .not("cached_median_rent", "is", null)
        .gt("cached_median_rent", 0)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data?.length) break;

      for (const row of data) {
        const name =
          typeof row.neighborhood === "string" ? row.neighborhood.trim() : "";
        const rent = Number(row.cached_median_rent);
        if (!name || !Number.isFinite(rent) || rent <= 0) continue;
        const prev = sums.get(name) ?? { sum: 0, count: 0 };
        prev.sum += rent;
        prev.count += 1;
        sums.set(name, prev);
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const result: Record<string, number> = {};
    for (const [name, { sum, count }] of Array.from(sums.entries())) {
      if (count > 0) result[name] = Math.round(sum / count);
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load neighborhood rent medians";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
