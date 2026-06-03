import type { SupabaseClient } from "@supabase/supabase-js";

export type SubmissionKind = "review" | "rent" | "micro_rating";

const LIMITS: Record<SubmissionKind, { max: number; hours: number }> = {
  review: { max: 8, hours: 24 },
  rent: { max: 12, hours: 24 },
  micro_rating: { max: 20, hours: 24 },
};

export async function assertSubmissionRateLimit(
  admin: SupabaseClient,
  userId: string,
  kind: SubmissionKind
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { max, hours } = LIMITS[kind];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  if (kind === "review") {
    const { count, error } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", "user")
      .gte("created_at", since);
    if (error) return { ok: true };
    if ((count ?? 0) >= max) {
      return {
        ok: false,
        message: `Review limit reached (${max} per ${hours}h). Try again later.`,
      };
    }
    return { ok: true };
  }

  if (kind === "rent") {
    const { count, error } = await admin
      .from("pricing_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("recorded_at", since);
    if (error) return { ok: true };
    if ((count ?? 0) >= max) {
      return {
        ok: false,
        message: `Rent report limit reached (${max} per ${hours}h).`,
      };
    }
    return { ok: true };
  }

  if (kind === "micro_rating") {
    const { count, error } = await admin
      .from("building_micro_ratings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (error) return { ok: true };
    if ((count ?? 0) >= max) {
      return {
        ok: false,
        message: `Quick rating limit reached (${max} per ${hours}h).`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}
