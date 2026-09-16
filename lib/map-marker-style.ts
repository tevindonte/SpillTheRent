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

export function hpdViolationColor(
  score: string | null | undefined
): string | null {
  switch (score) {
    case "Clean":
      return MAP_COLORS.green;
    case "Minor":
      return MAP_COLORS.yellow;
    case "Moderate":
      return MAP_COLORS.orange;
    case "Severe":
      return MAP_COLORS.red;
    default:
      return null;
  }
}

/**
 * Dot color priority:
 * 1. community / Google rating
 * 2. HPD violation score
 * 3. bedbug history → red
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

/** Pseudo-score for cluster averages when only gov signals exist. */
export function mapScoreOrSignal(complex: Complex): number | null {
  const score = mapScore(complex);
  if (score != null) return score;
  switch (complex.hpd_violation_score) {
    case "Clean":
      return 4.5;
    case "Minor":
      return 3.5;
    case "Moderate":
      return 2.5;
    case "Severe":
      return 1.5;
    default:
      break;
  }
  if (complex.has_bedbug_history) return 1.5;
  return null;
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

export function clusterColorFromScores(scores: number[]): string {
  if (!scores.length) return MAP_COLORS.gray;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  // Moderate HPD band (~2–3) → orange (not in ratingColor).
  if (avg >= 2 && avg < 3) return MAP_COLORS.orange;
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
