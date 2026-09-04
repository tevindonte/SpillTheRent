/** Bounding box in WGS84 (south/west/north/east). */
export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Leaflet-compatible bounds shape for MapLibre adapters. */
export type BoundsLike = {
  getSouthWest: () => { lat: number; lng: number };
  getNorthEast: () => { lat: number; lng: number };
};

export function mapLibreBoundsToBoundsLike(bounds: {
  getSouth: () => number;
  getWest: () => number;
  getNorth: () => number;
  getEast: () => number;
}): BoundsLike {
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  return {
    getSouthWest: () => ({ lat: south, lng: west }),
    getNorthEast: () => ({ lat: north, lng: east }),
  };
}

/** ~1.3 km tiles at Manhattan latitude — balances cache hits vs query size. */
export const MAP_TILE_SIZE = 0.012;

/** Fixed degree buffer around viewport so markers don't pop in late. */
export const BOUNDS_BUFFER_DEGREES = 0.05;
export const MARKER_ZOOM_THRESHOLD = 14;
export const BOUNDS_DEBOUNCE_MS = 300;

export function expandBounds(
  bounds: MapBounds,
  bufferDeg = BOUNDS_BUFFER_DEGREES
): MapBounds {
  return {
    south: bounds.south - bufferDeg,
    north: bounds.north + bufferDeg,
    west: bounds.west - bufferDeg,
    east: bounds.east + bufferDeg,
  };
}

export function latLngBoundsToMapBounds(bounds: BoundsLike): MapBounds {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    south: sw.lat,
    west: sw.lng,
    north: ne.lat,
    east: ne.lng,
  };
}

export function getTileKeys(bounds: MapBounds): string[] {
  const keys = new Set<string>();
  const latStart = Math.floor(bounds.south / MAP_TILE_SIZE);
  const latEnd = Math.floor(bounds.north / MAP_TILE_SIZE);
  const lngStart = Math.floor(bounds.west / MAP_TILE_SIZE);
  const lngEnd = Math.floor(bounds.east / MAP_TILE_SIZE);

  for (let lat = latStart; lat <= latEnd; lat++) {
    for (let lng = lngStart; lng <= lngEnd; lng++) {
      keys.add(`${lat}:${lng}`);
    }
  }
  return Array.from(keys);
}

export function tileToBounds(tileKey: string): MapBounds {
  const [latIndex, lngIndex] = tileKey.split(":").map(Number);
  return {
    south: latIndex * MAP_TILE_SIZE,
    north: (latIndex + 1) * MAP_TILE_SIZE,
    west: lngIndex * MAP_TILE_SIZE,
    east: (lngIndex + 1) * MAP_TILE_SIZE,
  };
}

export function isInBounds(
  lat: number,
  lng: number,
  bounds: MapBounds
): boolean {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

export function hasValidMapCoordinates(
  complex: { lat?: number | null; lng?: number | null }
): boolean {
  const { lat, lng } = complex;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}
