import { createClient } from "@/lib/supabase/client";

export type MapFilters = {
  rentStabilizedOnly?: boolean;
  hasHpdViolations?: boolean;
  minGoogleRating?: number;
};

export type Complex = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
  units: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  street_view_url: string | null;
  median_rent: number | null;
  review_count: number;
  hpd_open_violations?: number;
  hpd_violation_score?: string | null;
  is_rent_stabilized?: boolean;
  lat: number;
  lng: number;
};

type ComplexRow = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
  units: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  coordinates: unknown;
};

type MapSummaryRow = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
  units: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  street_view_url: string | null;
  lat: number;
  lng: number;
  median_rent: number | null;
  review_count: number | null;
  hpd_open_violations?: number | null;
  hpd_violation_score?: string | null;
  is_rent_stabilized?: boolean | null;
};

function normalizeHexString(value: string): string {
  return value.trim().replace(/^\\x/i, "").replace(/^0x/i, "").replace(/\s/g, "");
}

export function parseWkbHex(hex: string): { lat: number; lng: number } | null {
  const clean = normalizeHexString(hex);
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length < 42) return null;

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = bytes[0] === 1;
  const geometryType = view.getUint32(1, littleEndian);

  if ((geometryType & 0xff) !== 1) return null;

  let offset = 5;
  if (geometryType & 0x20000000) offset += 4;

  if (bytes.length < offset + 16) return null;

  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function parseCoordinates(raw: unknown): { lat: number; lng: number } | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();

    if (trimmed.startsWith("{")) {
      try {
        return parseCoordinates(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }

    const hexBody = normalizeHexString(trimmed);
    if (/^[0-9a-fA-F]+$/.test(hexBody) && hexBody.length >= 42) {
      return parseWkbHex(hexBody);
    }

    const pointMatch = trimmed.match(
      /POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)/i
    );
    if (pointMatch) {
      const lng = parseFloat(pointMatch[1]);
      const lat = parseFloat(pointMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    return null;
  }

  if (Array.isArray(raw) && raw.length >= 2) {
    const [a, b] = raw;
    if (typeof a === "number" && typeof b === "number") {
      return { lng: a, lat: b };
    }
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    if (obj.type === "Point" && Array.isArray(obj.coordinates)) {
      const lng = parseFloat(String(obj.coordinates[0]));
      const lat = parseFloat(String(obj.coordinates[1]));
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export function ratingColor(rating: number | null): string {
  if (rating == null) return "#6b7280";
  if (rating >= 4) return "#22c55e";
  if (rating >= 3) return "#eab308";
  return "#ef4444";
}

export function formatRating(rating: number | null): string {
  if (rating == null) return "No rating yet";
  return rating.toFixed(1);
}

function rowToComplex(row: MapSummaryRow): Complex {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    borough: row.borough,
    zip: row.zip,
    units: row.units,
    google_rating: row.google_rating,
    google_review_count: row.google_review_count,
    street_view_url: row.street_view_url ?? null,
    median_rent: row.median_rent,
    lat: Number(row.lat),
    lng: Number(row.lng),
    review_count: row.review_count ?? 0,
    hpd_open_violations: row.hpd_open_violations ?? 0,
    hpd_violation_score: row.hpd_violation_score ?? null,
    is_rent_stabilized: row.is_rent_stabilized ?? false,
  };
}

const MAP_SUMMARY_COLUMNS =
  "id, name, address, borough, zip, units, google_rating, google_review_count, street_view_url, lat, lng, median_rent, review_count, hpd_open_violations, hpd_violation_score, is_rent_stabilized";

async function fetchMapSummaryPage(
  supabase: ReturnType<typeof createClient>,
  options: {
    offset: number;
    pageSize: number;
    south?: number;
    north?: number;
    west?: number;
    east?: number;
    filters?: MapFilters;
  }
) {
  let query = supabase
    .from("complexes_map_summary")
    .select(MAP_SUMMARY_COLUMNS);

  if (options.south != null) query = query.gte("lat", options.south);
  if (options.north != null) query = query.lte("lat", options.north);
  if (options.west != null) query = query.gte("lng", options.west);
  if (options.east != null) query = query.lte("lng", options.east);

  const f = options.filters;
  if (f?.rentStabilizedOnly) query = query.eq("is_rent_stabilized", true);
  if (f?.hasHpdViolations) query = query.gt("hpd_open_violations", 0);
  if (f?.minGoogleRating != null && f.minGoogleRating > 0) {
    query = query.gte("google_rating", f.minGoogleRating);
  }

  return query.range(options.offset, options.offset + options.pageSize - 1);
}

function rowsToComplexes(batch: MapSummaryRow[]): Complex[] {
  const complexes: Complex[] = [];
  for (const row of batch) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    complexes.push(rowToComplex(row));
  }
  return complexes;
}

async function fetchFromMapSummary(
  supabase: ReturnType<typeof createClient>,
  bounds?: { south: number; north: number; west: number; east: number },
  filters?: MapFilters
) {
  const pageSize = 1000;
  const complexes: Complex[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await fetchMapSummaryPage(supabase, {
      offset,
      pageSize,
      south: bounds?.south,
      north: bounds?.north,
      west: bounds?.west,
      east: bounds?.east,
      filters,
    });

    if (error) return { complexes: null, error };

    const batch = (data ?? []) as MapSummaryRow[];
    if (!batch.length) break;

    complexes.push(...rowsToComplexes(batch));

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return { complexes, error: null };
}

async function fetchFromCoordinatesTable(
  supabase: ReturnType<typeof createClient>
) {
  const pageSize = 1000;
  const rows: ComplexRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("complexes")
      .select(
        "id, name, address, borough, zip, units, google_rating, google_review_count, street_view_url, coordinates"
      )
      .not("coordinates", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as ComplexRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const complexes: Complex[] = [];
  for (const row of rows) {
    const point = parseCoordinates(row.coordinates);
    if (!point) continue;
    complexes.push({
      id: row.id,
      name: row.name,
      address: row.address,
      borough: row.borough,
      zip: row.zip,
      units: row.units,
      google_rating: row.google_rating,
      google_review_count: row.google_review_count,
      street_view_url: (row as { street_view_url?: string }).street_view_url ?? null,
      median_rent: null,
      lat: point.lat,
      lng: point.lng,
      review_count: 0,
    });
  }

  return complexes;
}

export async function fetchComplexes(): Promise<Complex[]> {
  const supabase = createClient();
  const fromView = await fetchFromMapSummary(supabase);
  if (fromView.complexes) return fromView.complexes;
  return fetchFromCoordinatesTable(supabase);
}

/** Fetch complexes inside a bounding box (paginated). */
export async function fetchComplexesInBounds(
  bounds: {
    south: number;
    north: number;
    west: number;
    east: number;
  },
  filters?: MapFilters
): Promise<Complex[]> {
  const supabase = createClient();
  const fromView = await fetchFromMapSummary(supabase, bounds, filters);
  if (fromView.complexes) return fromView.complexes;

  const all = await fetchFromCoordinatesTable(supabase);
  return all.filter((c) => {
    if (
      c.lat < bounds.south ||
      c.lat > bounds.north ||
      c.lng < bounds.west ||
      c.lng > bounds.east
    ) {
      return false;
    }
    if (filters?.rentStabilizedOnly && !c.is_rent_stabilized) return false;
    if (filters?.hasHpdViolations && !(c.hpd_open_violations && c.hpd_open_violations > 0))
      return false;
    if (
      filters?.minGoogleRating != null &&
      filters.minGoogleRating > 0 &&
      (c.google_rating == null || c.google_rating < filters.minGoogleRating)
    ) {
      return false;
    }
    return true;
  });
}

export type ComplexDetail = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
  units: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  street_view_url: string | null;
  lat: number;
  lng: number;
  median_rent: number | null;
  red_flags: string[];
  google_place_id: string | null;
  reviews: {
    id: string;
    rating: number | null;
    review_text: string | null;
    source: string;
    review_date: string | null;
    is_anonymous?: boolean;
    author_handle?: string | null;
  }[];
};

export async function fetchComplexDetail(id: string): Promise<ComplexDetail> {
  const res = await fetch(`/api/complexes/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load building");
  }
  return res.json();
}
