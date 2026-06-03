const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_COMPARE_URL = 3;

export function isValidCompareId(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export function parseCompareParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!isValidCompareId(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_COMPARE_URL) break;
  }
  return ids;
}

export function buildCompareParam(ids: string[]): string | null {
  const valid = ids.filter(isValidCompareId).slice(0, MAX_COMPARE_URL);
  return valid.length ? valid.join(",") : null;
}

/** Merge compare ids into existing search params (preserves `building`, etc.). */
export function compareSearchString(
  current: URLSearchParams,
  ids: string[]
): string {
  const next = new URLSearchParams(current.toString());
  const param = buildCompareParam(ids);
  if (param) next.set("compare", param);
  else next.delete("compare");
  const qs = next.toString();
  return qs ? `?${qs}` : "/";
}

export function compareShareUrl(origin: string, ids: string[]): string {
  const param = buildCompareParam(ids);
  if (!param) return origin;
  const base = origin.replace(/\/$/, "");
  return `${base}/?compare=${encodeURIComponent(param)}`;
}
