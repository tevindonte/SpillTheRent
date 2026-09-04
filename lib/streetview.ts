/** Sentinel stored when Google has no imagery at a location. */
export const STREET_VIEW_NONE = "NONE";

const OSM_PAD = 0.002;

/**
 * Free OpenStreetMap embed centered on the building (no Google billing).
 */
export function osmEmbedUrl(lat: number, lng: number): string {
  const west = lng - OSM_PAD;
  const south = lat - OSM_PAD;
  const east = lng + OSM_PAD;
  const north = lat + OSM_PAD;
  const bbox = `${west},${south},${east},${north}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}

/**
 * Resolve panel map embed from stored coords / building lat-lng.
 * Returns null only when coordinates are invalid or imagery was marked NONE
 * and we still lack usable lat/lng (caller always passes complex coords).
 */
export function panelMapEmbedUrl(
  stored: string | null | undefined,
  lat: number,
  lng: number
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (stored && stored !== STREET_VIEW_NONE) {
    try {
      const url = new URL(stored);
      const location = url.searchParams.get("location");
      if (location) {
        const [latStr, lngStr] = location.split(",");
        const parsedLat = Number(latStr);
        const parsedLng = Number(lngStr);
        if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
          return osmEmbedUrl(parsedLat, parsedLng);
        }
      }
    } catch {
      // fall through
    }
  }

  // Still show OSM pin for buildings with no street imagery; location is free.
  return osmEmbedUrl(lat, lng);
}

/** @deprecated Use osmEmbedUrl */
export function streetViewEmbedUrl(lat: number, lng: number): string {
  return osmEmbedUrl(lat, lng);
}

/** @deprecated Use panelMapEmbedUrl */
export function streetViewEmbedFromStored(
  stored: string | null | undefined,
  lat: number,
  lng: number
): string | null {
  return panelMapEmbedUrl(stored, lat, lng);
}

/** @deprecated Use osmEmbedUrl */
export function streetViewProxyUrl(lat: number, lng: number): string {
  return osmEmbedUrl(lat, lng);
}

/** @deprecated */
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
        return osmEmbedUrl(lat, lng);
      }
    }
  } catch {
    // not a valid URL
  }
  return null;
}
