export type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  borough?: string;
  city_district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

export type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

export type GeocodedBuilding = {
  name: string;
  address: string;
  street: string | null;
  city: string | null;
  zip: string | null;
  borough: string | null;
  lat: number;
  lng: number;
  state: string | null;
};

function buildStreet(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null;
  const parts = [addr.house_number, addr.road].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function pickCity(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null;
  return addr.city ?? addr.town ?? addr.village ?? null;
}

function pickBorough(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null;
  const raw =
    addr.borough ??
    addr.city_district ??
    addr.suburb ??
    addr.neighbourhood ??
    null;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("manhattan")) return "Manhattan";
  if (lower.includes("brooklyn")) return "Brooklyn";
  if (lower.includes("queens")) return "Queens";
  if (lower.includes("bronx")) return "Bronx";
  if (lower.includes("staten")) return "Staten Island";
  if (lower.includes("long island city") || lower === "lic") return "Queens";
  return raw;
}

export function isNewYorkState(addr: NominatimAddress | undefined): boolean {
  if (!addr) return false;
  const state = (addr.state ?? "").trim().toLowerCase();
  return state === "new york" || state === "ny";
}

/** NYC five boroughs / New York City, not upstate NY. */
export function isNycAddress(addr: NominatimAddress | undefined): boolean {
  if (!isNewYorkState(addr)) return false;
  const city = (addr?.city ?? addr?.town ?? "").toLowerCase();
  if (city === "new york" || city.includes("new york city")) return true;

  const place = [
    addr?.borough,
    addr?.city_district,
    addr?.suburb,
    addr?.neighbourhood,
    addr?.county,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    place.includes("manhattan") ||
    place.includes("brooklyn") ||
    place.includes("queens") ||
    place.includes("bronx") ||
    place.includes("staten island") ||
    place.includes("long island city") ||
    place.includes("kings county") ||
    place.includes("new york county") ||
    place.includes("queens county") ||
    place.includes("richmond county") ||
    place.includes("bronx county")
  );
}

/**
 * Free OpenStreetMap Nominatim geocoding (no API key).
 * Usage policy: identify app via User-Agent; keep request rate modest.
 */
export async function searchNominatim(
  query: string
): Promise<{ result: NominatimResult | null; error?: string }> {
  const q = `${query.trim()} New York`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "spilltherent/1.0 (spillthe.rent)",
      },
    });
  } catch {
    return { result: null, error: "Geocoding service unreachable" };
  }

  if (!response.ok) {
    return { result: null, error: `Geocoding HTTP ${response.status}` };
  }

  const payload = (await response.json()) as NominatimResult[];
  if (!Array.isArray(payload) || payload.length === 0) {
    return { result: null };
  }

  return { result: payload[0] };
}

export function nominatimToBuilding(
  result: NominatimResult,
  fallbackQuery: string
): GeocodedBuilding {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  const addr = result.address;
  // Prefer a short street line for the building name when Nominatim provides it.
  const street = buildStreet(addr);
  const display = result.display_name?.trim() || fallbackQuery.trim();
  const name = street
    ? [street, pickCity(addr) ?? "New York", addr?.postcode].filter(Boolean).join(", ")
    : display;

  return {
    // Formatted address as initial name (no Google marketing name).
    name,
    address: display,
    street,
    city: pickCity(addr),
    zip: addr?.postcode ?? null,
    borough: pickBorough(addr),
    lat,
    lng,
    state: addr?.state ?? null,
  };
}
