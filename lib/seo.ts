export const SITE_NAME = "spillthe.rent";

export const DEFAULT_TITLE =
  "spillthe.rent NYC Apartment Reviews & Building Violation Records";

export const DEFAULT_DESCRIPTION =
  "Search 20,000+ Manhattan, Brooklyn & LIC apartments. See HPD violations, bedbug history, tenant lawsuits, and real rent prices before you sign a lease. Free, no landlord ads.";

/** Server-safe canonical origin (no window). */
export function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const renderUrl = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
  if (renderUrl) {
    return renderUrl.startsWith("http") ? renderUrl : `https://${renderUrl}`;
  }

  return "https://spillthe.rent";
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
