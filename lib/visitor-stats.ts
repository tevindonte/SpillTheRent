/** First-party visitor stats helpers. */

/**
 * Pre-tracking estimate for TikTok-driven visits (no in-video link).
 * Scaled up as the video grew from ~15k → ~20k views.
 */
export const VISITOR_BASELINE = 500;

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
