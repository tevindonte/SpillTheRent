/**
 * Dark Matter raster tiles from CARTO (OSM data).
 * Free API key required — without it every tile is watermarked
 * "API KEY REQUIRED / carto.com/basemaps/apikey".
 * Request: https://carto.com/basemaps/apikey/
 */
function cartoTileUrl(): string {
  const base =
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const key = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
  return key ? `${base}?key=${encodeURIComponent(key)}` : base;
}

export const MAP_TILE_URL = cartoTileUrl();

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Leaflet uses [lat, lng]. */
export const DEFAULT_MAP_CENTER: [number, number] = [40.7128, -73.98];
export const DEFAULT_MAP_ZOOM = 12;

/** Default view: Manhattan, Brooklyn, and Long Island City. */
export const NYC_MAP_BOUNDS: [[number, number], [number, number]] = [
  [40.55, -74.05],
  [40.92, -73.85],
];

/** @deprecated Use DEFAULT_MAP_CENTER — kept for single-borough fallbacks */
export const MANHATTAN_CENTER: [number, number] = [40.7831, -73.9712];
export const MANHATTAN_ZOOM = 13;
export const MANHATTAN_BOUNDS: [[number, number], [number, number]] = [
  [40.7, -74.02],
  [40.88, -73.91],
];
