const STORAGE_KEY = "spr_vote_token";

export function getAnonymousVoteToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}
