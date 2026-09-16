export type MapColorMode = "rating" | "rent";

export const MAP_MODE_STORAGE_KEY = "spr_map_mode";

export const MAP_COLORS = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  gray: "#6b7280",
} as const;

export function loadMapColorMode(): MapColorMode {
  if (typeof window === "undefined") return "rating";
  try {
    const raw = localStorage.getItem(MAP_MODE_STORAGE_KEY);
    if (raw === "rent" || raw === "rating") return raw;
  } catch {
    /* ignore */
  }
  return "rating";
}

export function saveMapColorMode(mode: MapColorMode): void {
  try {
    localStorage.setItem(MAP_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/**
 * Building rent vs neighborhood average.
 * < 0.90 deal (green), 0.90–1.10 fair (yellow), > 1.10 overpriced (red),
 * null/0 = no data (gray).
 */
export function rentRatioColor(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) {
    return MAP_COLORS.gray;
  }
  if (ratio < 0.9) return MAP_COLORS.green;
  if (ratio <= 1.1) return MAP_COLORS.yellow;
  return MAP_COLORS.red;
}

export function rentColorFromBuilding(
  buildingRent: number | null | undefined,
  neighborhoodAvg: number | null | undefined
): string {
  if (
    buildingRent == null ||
    !Number.isFinite(buildingRent) ||
    buildingRent <= 0 ||
    neighborhoodAvg == null ||
    !Number.isFinite(neighborhoodAvg) ||
    neighborhoodAvg <= 0
  ) {
    return MAP_COLORS.gray;
  }
  return rentRatioColor(buildingRent / neighborhoodAvg);
}

/**
 * MapLibre circle-color for By Rating.
 * Green/yellow ONLY from community or Google scores.
 * HPD: Severe→red, Moderate→orange, Minor/Clean→gray.
 * Bedbug red only when no rating and no HPD score.
 */
export const MVT_RATING_CIRCLE_COLOR = [
  "case",
  [">=", ["to-number", ["coalesce", ["get", "score"], 0]], 1],
  [
    "case",
    [">=", ["to-number", ["get", "score"]], 4],
    MAP_COLORS.green,
    [">=", ["to-number", ["get", "score"]], 3],
    MAP_COLORS.yellow,
    MAP_COLORS.red,
  ],
  [
    "match",
    ["to-number", ["coalesce", ["get", "hpd_score_num"], 0]],
    4,
    MAP_COLORS.gray,
    3,
    MAP_COLORS.gray,
    2,
    MAP_COLORS.orange,
    1,
    MAP_COLORS.red,
    [
      "case",
      [">", ["to-number", ["coalesce", ["get", "has_bedbug"], 0]], 0],
      MAP_COLORS.red,
      MAP_COLORS.gray,
    ],
  ],
] as const;

/** MapLibre circle-color for By Rent (property: rent_ratio). */
export const MVT_RENT_CIRCLE_COLOR = [
  "case",
  ["!", ["has", "rent_ratio"]],
  MAP_COLORS.gray,
  ["==", ["get", "rent_ratio"], null],
  MAP_COLORS.gray,
  ["<=", ["get", "rent_ratio"], 0],
  MAP_COLORS.gray,
  ["<", ["get", "rent_ratio"], 0.9],
  MAP_COLORS.green,
  ["<=", ["get", "rent_ratio"], 1.1],
  MAP_COLORS.yellow,
  MAP_COLORS.red,
] as const;
