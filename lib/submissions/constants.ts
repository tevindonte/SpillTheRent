export const RED_FLAG_OPTIONS = [
  { label: "Mold", value: "mold" },
  { label: "Roaches", value: "roaches" },
  { label: "Maintenance Issues", value: "maintenance" },
  { label: "Deposit Problems", value: "deposit" },
  { label: "Noise", value: "noise" },
  { label: "Safety Concerns", value: "safety" },
  { label: "Flooding", value: "flooding" },
  { label: "Heat/AC Problems", value: "heat_ac" },
  { label: "Other", value: "other" },
] as const;

export const MOVE_IN_YEAR_START = 2010;

export type RedFlagValue = (typeof RED_FLAG_OPTIONS)[number]["value"];

export const BEDROOM_OPTIONS = [
  { label: "Studio", value: "studio", bedrooms: 0 },
  { label: "1", value: "1", bedrooms: 1 },
  { label: "2", value: "2", bedrooms: 2 },
  { label: "3+", value: "3+", bedrooms: 3 },
] as const;

export type BedroomOption = (typeof BEDROOM_OPTIONS)[number]["value"];

export const UNIT_COUNT_OPTIONS = [
  { label: "10–25", value: "10-25", units: 18 },
  { label: "26–50", value: "26-50", units: 38 },
  { label: "51–100", value: "51-100", units: 75 },
  { label: "100+", value: "100+", units: 120 },
] as const;

export type UnitCountOption = (typeof UNIT_COUNT_OPTIONS)[number]["value"];

export const RESIDENTIAL_PLACE_TYPES = new Set([
  "apartment_building",
  "lodging",
  "premise",
  "subpremise",
  "street_address",
  "neighborhood",
  "establishment",
]);

export const NON_RESIDENTIAL_PLACE_TYPES = new Set([
  "store",
  "restaurant",
  "food",
  "cafe",
  "bar",
  "bank",
  "hospital",
  "school",
  "church",
  "gas_station",
  "parking",
]);
