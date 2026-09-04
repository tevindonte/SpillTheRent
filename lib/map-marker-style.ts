import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";

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
