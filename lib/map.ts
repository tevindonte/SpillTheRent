/**
 * Carto Dark Matter vector style for MapLibre.
 * Optional free API key: https://carto.com/basemaps/apikey/
 */
export function getMapLibreStyleUrl(): string {
  const base =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
  const key = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
  return key ? `${base}?key=${encodeURIComponent(key)}` : base;
}

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** MapLibre uses [lng, lat]. Manhattan-centric default view. */
export const DEFAULT_MAP_CENTER_LNG_LAT: [number, number] = [
  -73.9712, 40.7831,
];
export const DEFAULT_MAP_ZOOM = 12;

/** Legacy [lat, lng] — used by non-map helpers. */
export const DEFAULT_MAP_CENTER: [number, number] = [40.7128, -73.98];

/** Default view: Manhattan, Brooklyn, and Long Island City. */
export const NYC_MAP_BOUNDS: [[number, number], [number, number]] = [
  [40.55, -74.05],
  [40.92, -73.85],
];

/** @deprecated Use DEFAULT_MAP_CENTER_LNG_LAT — kept for single-borough fallbacks */
export const MANHATTAN_CENTER: [number, number] = [40.7831, -73.9712];
export const MANHATTAN_ZOOM = 13;
export const MANHATTAN_BOUNDS: [[number, number], [number, number]] = [
  [40.7, -74.02],
  [40.88, -73.91],
];
