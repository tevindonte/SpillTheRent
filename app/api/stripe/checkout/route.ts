import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLeaseShieldCheckout, getStripe } from "@/lib/stripe";

export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Payments are not configured yet." },
      { status: 503 }
    );
  }

  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const profile = await ensureProfile(admin, user.id, user.email);

  try {
    const url = await createLeaseShieldCheckout(
      stripe,
      user.id,
      profile.email
    );
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
