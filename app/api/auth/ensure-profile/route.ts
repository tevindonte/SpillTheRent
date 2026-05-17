import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";

export async function POST() {
  const { user, supabase } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await ensureProfile(supabase, user.id, user.email);
  return NextResponse.json({ profile });
}
