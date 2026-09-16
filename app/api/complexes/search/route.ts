import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Strip paste junk (middle dots, commas) and collapse whitespace. */
function normalizeQuery(raw: string): string {
  return raw
    .replace(/[·•|]/g, " ")
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractZip(q: string): string | null {
  const m = q.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m?.[1] ?? null;
}

/** Address/name part without ZIP so we don't require zip inside address text. */
function streetQuery(q: string, zip: string | null): string {
  let s = q;
  if (zip) {
    s = s.replace(new RegExp(`\\b${zip}(?:-\\d{4})?\\b`), " ");
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Escape for PostgREST filter string (double-quoted value). */
function quoteIlikePattern(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const q = normalizeQuery(raw);
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const zip = extractZip(q);
  const street = streetQuery(q, zip);
  const supabase = createClient();

  // ZIP-only search.
  if (zip && street.length < 2) {
    const { data, error } = await supabase
      .from("complexes")
      .select(
        "id, name, address, borough, zip, hpd_open_violations, hpd_violation_score"
      )
      .eq("zip", zip)
      .order("name")
      .limit(12);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ results: data ?? [] });
  }

  const pattern = quoteIlikePattern(street.length >= 2 ? street : q);
  let query = supabase
    .from("complexes")
    .select(
      "id, name, address, borough, zip, hpd_open_violations, hpd_violation_score"
    )
    .or(`name.ilike.${pattern},address.ilike.${pattern}`);

  if (zip) {
    query = query.eq("zip", zip);
  }

  const { data, error } = await query.order("name").limit(12);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If zip filter was too strict (wrong/missing zip on row), retry without it.
  if (zip && street.length >= 2 && (data?.length ?? 0) === 0) {
    const retry = await supabase
      .from("complexes")
      .select(
        "id, name, address, borough, zip, hpd_open_violations, hpd_violation_score"
      )
      .or(`name.ilike.${pattern},address.ilike.${pattern}`)
      .order("name")
      .limit(12);
    if (retry.error) {
      return NextResponse.json({ error: retry.error.message }, { status: 500 });
    }
    return NextResponse.json({ results: retry.data ?? [] });
  }

  return NextResponse.json({ results: data ?? [] });
}
