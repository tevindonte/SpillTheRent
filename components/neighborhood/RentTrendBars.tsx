import { formatRent } from "@/lib/format";

export type RentTrendPoint = {
  month: string;
  label: string;
  median_rent: number | null;
  sample_count: number;
};

export function RentTrendBars({ points }: { points: RentTrendPoint[] }) {
  const withRent = points.filter((p) => p.median_rent != null);
  if (withRent.length < 2) {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        Not enough rent reports yet to show a trend for this neighborhood.
      </p>
    );
  }

  const max = Math.max(...withRent.map((p) => p.median_rent!));

  return (
    <div className="mt-4 space-y-2">
      {withRent.map((p) => {
        const pct = max > 0 ? Math.round((p.median_rent! / max) * 100) : 0;
        return (
          <div key={p.month} className="flex items-center gap-3 text-xs">
            <span className="w-14 shrink-0 text-neutral-500">{p.label}</span>
            <div className="h-2 min-w-0 flex-1 rounded-full bg-neutral-800">
              <div
                className="h-2 rounded-full bg-orange-500/80"
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-neutral-300">
              {formatRent(p.median_rent!)}
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-neutral-600">
        Median from tenant-reported and scraped rent data per month.
      </p>
    </div>
  );
}
