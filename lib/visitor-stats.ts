/** First-party visitor stats + public social-proof labels. */

/**
 * Pre-tracking estimate for TikTok-driven visits (no in-video link).
 * Scaled as the video grew from ~15k → ~20k views.
 */
export const VISITOR_BASELINE = 500;

/** Public TikTok view count for marketing copy. */
export const TIKTOK_VIEWS_LABEL = "20k+";

export function displayVisitorCount(uniqueTracked: number): number {
  const n = Math.max(0, Math.floor(uniqueTracked));
  return VISITOR_BASELINE + n;
}

export function formatVisitorCount(uniqueTracked: number): string {
  const n = displayVisitorCount(uniqueTracked);
  if (n >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) ? `${k}k+` : `${k.toFixed(1).replace(/\.0$/, "")}k+`;
  }
  return `${n}+`;
}

export function tiktokSeenByLine(): string {
  return `Seen by ${TIKTOK_VIEWS_LABEL} people on TikTok`;
}
