import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";
import { rentColorFromBuilding, rentRatioColor } from "@/lib/map-color-mode";

/** Unified map score: spill score → Google → none. */
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
  if (!scores.length) return ratingColor(null);
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
    return ratingColor(mapScore(complex));
  }
  const rent = mapBuildingRent(complex);
  const hood = complex.neighborhood?.trim() ?? "";
  const hoodAvg = hood ? neighborhoodMedians[hood] : null;
  return rentColorFromBuilding(rent, hoodAvg ?? null);
}
