"use client";

import type { QuickRatingStats } from "@/lib/quick-ratings";

const BARS: {
  key: keyof Pick<
    QuickRatingStats,
    "avg_pests" | "avg_management" | "avg_heat" | "avg_noise"
  >;
  label: string;
}[] = [
  { key: "avg_pests", label: "Pests" },
  { key: "avg_management", label: "Management" },
  { key: "avg_heat", label: "Heat/Hot Water" },
  { key: "avg_noise", label: "Noise" },
];

type QuickRatingsBreakdownProps = {
  stats: QuickRatingStats;
  /** Optional heading override (default includes submission count). */
  title?: string;
  className?: string;
};

export function QuickRatingsBreakdown({
  stats,
  title,
  className = "",
}: QuickRatingsBreakdownProps) {
  const count = stats.quick_rating_count;
  const heading =
    title ??
    `Quick Ratings (${count.toLocaleString()} submission${count === 1 ? "" : "s"})`;

  return (
    <section
      className={`rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 ${className}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {heading}
      </h3>
      <ul className="mt-3 space-y-2.5">
        {BARS.map(({ key, label }) => {
          const value = stats[key];
          const pct =
            value != null && Number.isFinite(value)
              ? Math.max(0, Math.min(100, (value / 5) * 100))
              : 0;
          return (
            <li key={key}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-xs text-neutral-400">{label}</span>
                <span className="text-xs font-medium tabular-nums text-neutral-200">
                  {value != null ? `${value.toFixed(1)}/5` : "-"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-orange-500/90 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                  role="presentation"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
