import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/auth/site-url";
import { ensureProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  const redirectTo = new URL(next, getSiteUrl());
  const supabase = createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await ensureProfile(supabase, user.id, user.email);
      }
      return NextResponse.redirect(redirectTo);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await ensureProfile(supabase, user.id, user.email);
      }
      return NextResponse.redirect(redirectTo);
    }
  }

  const loginUrl = new URL("/login", getSiteUrl());
  loginUrl.searchParams.set(
    "error",
    "Sign-in link expired or invalid. Request a new code."
  );
  return NextResponse.redirect(loginUrl);
}
