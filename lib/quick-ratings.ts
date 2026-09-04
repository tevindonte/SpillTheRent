export type QuickRatingStats = {
  avg_pests: number | null;
  avg_management: number | null;
  avg_heat: number | null;
  avg_noise: number | null;
  avg_overall: number | null;
  quick_rating_count: number;
};

type MicroRow = {
  pests: number | null;
  management: number | null;
  heat_hot_water: number | null;
  noise: number | null;
};

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function rowOverall(row: MicroRow): number | null {
  const parts = [row.pests, row.management, row.heat_hot_water, row.noise].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  return mean(parts);
}

/** Aggregate building_micro_ratings rows (same rules as complex_quick_rating_stats). */
export function aggregateQuickRatings(rows: MicroRow[]): QuickRatingStats {
  const pests = rows
    .map((r) => r.pests)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const management = rows
    .map((r) => r.management)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const heat = rows
    .map((r) => r.heat_hot_water)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const noise = rows
    .map((r) => r.noise)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const overalls = rows
    .map(rowOverall)
    .filter((v): v is number => v != null);

  return {
    avg_pests: mean(pests),
    avg_management: mean(management),
    avg_heat: mean(heat),
    avg_noise: mean(noise),
    avg_overall: mean(overalls),
    quick_rating_count: rows.length,
  };
}

export const QUICK_RATING_DISPLAY_MIN = 3;
