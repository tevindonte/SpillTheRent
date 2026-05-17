import {
  NON_RESIDENTIAL_PLACE_TYPES,
  RESIDENTIAL_PLACE_TYPES,
} from "@/lib/submissions/constants";

const FIND_PLACE_URL =
  "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";

export type FindPlaceCandidate = {
  place_id: string;
  formatted_address?: string;
  name?: string;
  types?: string[];
  geometry?: {
    location?: { lat: number; lng: number };
  };
};

export async function findPlaceFromText(
  query: string
): Promise<{ candidate: FindPlaceCandidate | null; error?: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return { candidate: null, error: "Google Places API not configured" };
  }

  const url = new URL(FIND_PLACE_URL);
  url.searchParams.set("input", query);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set(
    "fields",
    "place_id,formatted_address,name,types,geometry"
  );
  url.searchParams.set("key", key);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    return { candidate: null, error: `Google API HTTP ${response.status}` };
  }

  const payload = await response.json();
  const status = payload.status as string;

  if (status === "OK" && payload.candidates?.length) {
    return { candidate: payload.candidates[0] as FindPlaceCandidate };
  }
  if (status === "ZERO_RESULTS" || status === "NOT_FOUND") {
    return { candidate: null };
  }

  return {
    candidate: null,
    error: payload.error_message || `Google status: ${status}`,
  };
}

export function isResidentialPlace(types: string[] | undefined): boolean {
  if (!types?.length) return true;
  const lower = types.map((t) => t.toLowerCase());
  if (lower.some((t) => NON_RESIDENTIAL_PLACE_TYPES.has(t))) {
    if (!lower.some((t) => RESIDENTIAL_PLACE_TYPES.has(t))) {
      return false;
    }
  }
  return lower.some((t) => RESIDENTIAL_PLACE_TYPES.has(t)) || lower.length > 0;
}
