/** Neighborhood SEO slugs ↔ DB values */

export const BOROUGH_SLUGS = ["manhattan", "brooklyn", "queens", "bronx"] as const;
export type BoroughSlug = (typeof BOROUGH_SLUGS)[number];

export function slugifyNeighborhood(name: string): string {
  return name
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function boroughSlugFromCode(code: string | null): BoroughSlug | null {
  const c = (code ?? "").toUpperCase();
  if (c === "MN" || c === "MANHATTAN") return "manhattan";
  if (c === "BK" || c === "BROOKLYN") return "brooklyn";
  if (c === "QN" || c === "QUEENS") return "queens";
  if (c === "BX" || c === "BRONX") return "bronx";
  return null;
}

export function boroughLabel(slug: BoroughSlug): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function boroughDbMatch(slug: BoroughSlug): string[] {
  switch (slug) {
    case "manhattan":
      return ["Manhattan", "MN"];
    case "brooklyn":
      return ["Brooklyn", "BK"];
    case "queens":
      return ["Queens", "QN"];
    case "bronx":
      return ["Bronx", "BX"];
  }
}
