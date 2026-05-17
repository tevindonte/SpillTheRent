/** OpenStreetMap-based dark tiles (Carto uses OSM data; not Google Maps). */
export const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Leaflet uses [lat, lng]. */
export const MANHATTAN_CENTER: [number, number] = [40.7831, -73.9712];
export const MANHATTAN_ZOOM = 13;
export const MANHATTAN_BOUNDS: [[number, number], [number, number]] = [
  [40.7, -74.02],
  [40.88, -73.91],
];
