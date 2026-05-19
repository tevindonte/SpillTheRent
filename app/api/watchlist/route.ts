import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ saved: [], complex_ids: [] });
  }

  const { data, error } = await supabase
    .from("saved_buildings")
    .select("complex_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const complex_ids = (data ?? []).map((r) => r.complex_id);
  return NextResponse.json({ complex_ids, saved: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const complex_id = body.complex_id as string | undefined;
  if (!complex_id) {
    return NextResponse.json({ error: "complex_id required" }, { status: 400 });
  }

  const { error } = await supabase.from("saved_buildings").upsert({
    user_id: user.id,
    complex_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const complex_id = request.nextUrl.searchParams.get("complex_id");
  if (!complex_id) {
    return NextResponse.json({ error: "complex_id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_buildings")
    .delete()
    .eq("user_id", user.id)
    .eq("complex_id", complex_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
