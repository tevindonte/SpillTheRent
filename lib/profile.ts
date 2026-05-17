import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  handle: string;
  handle_changed: boolean;
  email: string | null;
  member_since: string;
  is_public: boolean;
};

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, handle, handle_changed, email, member_since, is_public")
    .eq("id", userId)
    .maybeSingle();
  return data as Profile | null;
}

export async function ensureProfile(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<Profile> {
  const existing = await getProfile(supabase, userId);
  if (existing) return existing;

  const handle = `anon-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      handle,
      email: email ?? null,
    })
    .select("id, handle, handle_changed, email, member_since, is_public")
    .single();

  if (error) throw error;
  return data as Profile;
}

export function displayAuthor(
  review: { is_anonymous?: boolean; author_handle?: string | null }
): string {
  if (review.is_anonymous !== false) return "Anonymous";
  if (review.author_handle) return `@${review.author_handle}`;
  return "Anonymous";
}
