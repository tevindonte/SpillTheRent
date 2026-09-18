import type { MapBounds } from "@/lib/map-bounds";

/** Same limits as /api/complexes/nearby (NYC + North Jersey). */
export const NYC_MIN_LAT = 40.4;
export const NYC_MAX_LAT = 41.0;
export const NYC_MIN_LNG = -74.3;
export const NYC_MAX_LNG = -73.6;

/** Greater Boston coverage for Massachusetts expansion. */
export const BOSTON_MIN_LAT = 42.2;
export const BOSTON_MAX_LAT = 42.45;
export const BOSTON_MIN_LNG = -71.25;
export const BOSTON_MAX_LNG = -70.9;

export function isInNycServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= NYC_MIN_LAT &&
    lat <= NYC_MAX_LAT &&
    lng >= NYC_MIN_LNG &&
    lng <= NYC_MAX_LNG
  );
}

export function isInBostonServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= BOSTON_MIN_LAT &&
    lat <= BOSTON_MAX_LAT &&
    lng >= BOSTON_MIN_LNG &&
    lng <= BOSTON_MAX_LNG
  );
}

/** NYC/NJ or Boston coverage. */
export function isInServiceArea(lat: number, lng: number): boolean {
  return isInNycServiceArea(lat, lng) || isInBostonServiceArea(lat, lng);
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

export function viewportOverlapsBoston(bounds: MapBounds): boolean {
  return !(
    bounds.north < BOSTON_MIN_LAT ||
    bounds.south > BOSTON_MAX_LAT ||
    bounds.east < BOSTON_MIN_LNG ||
    bounds.west > BOSTON_MAX_LNG
  );
}

export function viewportOverlapsServiceArea(bounds: MapBounds): boolean {
  return viewportOverlapsNyc(bounds) || viewportOverlapsBoston(bounds);
}
