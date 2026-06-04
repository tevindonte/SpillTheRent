import type { MapBounds } from "@/lib/map-bounds";

/** Same limits as /api/complexes/nearby */
export const NYC_MIN_LAT = 40.4;
export const NYC_MAX_LAT = 41.0;
export const NYC_MIN_LNG = -74.3;
export const NYC_MAX_LNG = -73.6;

export function isInNycServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= NYC_MIN_LAT &&
    lat <= NYC_MAX_LAT &&
    lng >= NYC_MIN_LNG &&
    lng <= NYC_MAX_LNG
  );
}

/** Viewport intersects NYC data coverage. */
export function viewportOverlapsNyc(bounds: MapBounds): boolean {
  return !(
    bounds.north < NYC_MIN_LAT ||
    bounds.south > NYC_MAX_LAT ||
    bounds.east < NYC_MIN_LNG ||
    bounds.west > NYC_MAX_LNG
  );
}
