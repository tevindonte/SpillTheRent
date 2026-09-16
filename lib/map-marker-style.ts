import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";
import {
  MAP_COLORS,
  rentColorFromBuilding,
  rentRatioColor,
} from "@/lib/map-color-mode";

/** Unified review score: spill score → Google → none. */
export function mapScore(complex: Complex): number | null {
  if (
    complex.cached_community_score != null &&
    Number.isFinite(complex.cached_community_score) &&
    complex.cached_community_score >= 1
  ) {
    return complex.cached_community_score;
  }
  if (
    complex.google_rating != null &&
    Number.isFinite(complex.google_rating) &&
    complex.google_rating >= 1
  ) {
    return complex.google_rating;
  }
  return null;
}

/**
 * HPD-only color. Clean/Minor are gray (never green/yellow).
 * Returns null when no HPD score so bedbug can apply.
 */
export function hpdViolationColor(
  score: string | null | undefined
): string | null {
  switch (score) {
    case "Severe":
      return MAP_COLORS.red;
    case "Moderate":
      return MAP_COLORS.orange;
    case "Minor":
    case "Clean":
      return MAP_COLORS.gray;
    default:
      return null;
  }
}

/**
 * Dot color priority:
 * 1. community / Google rating (green/yellow/red)
 * 2. HPD Severe→red, Moderate→orange, Minor/Clean→gray
 * 3. bedbug (only if no rating and no HPD score) → red
 * 4. gray
 */
export function mapRatingColor(complex: Complex): string {
  const score = mapScore(complex);
  if (score != null) return ratingColor(score);

  const hpd = hpdViolationColor(complex.hpd_violation_score);
  if (hpd) return hpd;

  if (complex.has_bedbug_history) return MAP_COLORS.red;
  return MAP_COLORS.gray;
}

export function mapBuildingRent(complex: Complex): number | null {
  const rent = complex.cached_median_rent ?? complex.median_rent;
  if (rent == null || !Number.isFinite(rent) || rent <= 0) return null;
  return rent;
}

export function clusterBubbleSize(count: number): number {
  if (count < 10) return 36;
  if (count < 100) return 44;
  return 52;
}

/** Dominant mapRatingColor among cluster members. */
export function clusterColorFromComplexes(complexes: Complex[]): string {
  if (!complexes.length) return MAP_COLORS.gray;
  const counts = new Map<string, number>();
  for (const c of complexes) {
    const color = mapRatingColor(c);
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best: string = MAP_COLORS.gray;
  let bestCount = -1;
  for (const [color, n] of Array.from(counts.entries())) {
    if (n > bestCount) {
      best = color;
      bestCount = n;
    }
  }
  return best;
}

/** @deprecated Prefer clusterColorFromComplexes for rating mode. */
export function clusterColorFromScores(scores: number[]): string {
  if (!scores.length) return MAP_COLORS.gray;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return ratingColor(avg);
}

export function clusterColorFromRentRatios(ratios: number[]): string {
  if (!ratios.length) return rentRatioColor(null);
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return rentRatioColor(avg);
}

export function markerColorForComplex(
  complex: Complex,
  mode: "rating" | "rent",
  neighborhoodMedians: Record<string, number>
): string {
  if (mode === "rating") {
    return mapRatingColor(complex);
  }
  const rent = mapBuildingRent(complex);
  const hood = complex.neighborhood?.trim() ?? "";
  const hoodAvg = hood ? neighborhoodMedians[hood] : null;
  return rentColorFromBuilding(rent, hoodAvg ?? null);
}
