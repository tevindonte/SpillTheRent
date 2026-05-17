/** Sentinel stored when Google has no imagery at a location. */
export const STREET_VIEW_NONE = "NONE";

/**
 * Client-safe proxy URL — API key is appended only on the server
 * at GET /api/streetview.
 */
export function streetViewProxyUrl(lat: number, lng: number): string {
  return `/api/streetview?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
}

/**
 * Resolve a keyless street_view_url from the database to the app proxy URL.
 */
export function streetViewUrlFromStored(
  stored: string | null | undefined
): string | null {
  if (!stored || stored === STREET_VIEW_NONE) return null;

  try {
    const url = new URL(stored);
    const location = url.searchParams.get("location");
    if (location) {
      const [latStr, lngStr] = location.split(",");
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return streetViewProxyUrl(lat, lng);
      }
    }
  } catch {
    // not a valid URL
  }

  return null;
}
