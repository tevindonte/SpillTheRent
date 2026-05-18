/** Canonical app origin for auth redirects (must match Supabase URL config). */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const renderUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
  if (renderUrl) {
    return renderUrl.startsWith("http") ? renderUrl : `https://${renderUrl}`;
  }

  return "http://localhost:3000";
}

export function authConfirmUrl(next = "/profile"): string {
  const nextPath = next.startsWith("/") ? next : `/${next}`;
  return `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}
