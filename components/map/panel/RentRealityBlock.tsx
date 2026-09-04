"use client";

import { formatRent, formatRentFull } from "@/lib/format";
import type { BuildingDetail } from "@/lib/building-detail";

type RentRealityBlockProps = {
  detail: BuildingDetail;
  onReportRent: () => void;
};

export function RentRealityBlock({ detail, onReportRent }: RentRealityBlockProps) {
  const reported = detail.median_rent;
  const reportCount = detail.rent_report_count;
  const byBed = detail.rent_by_bedroom ?? {};
  const byYear = detail.rent_by_year ?? [];
  const hasBreakdown = Object.keys(byBed).length > 0;
  const showTimeline = byYear.length > 1;

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Rent reality
        </h3>
        <span className="text-[10px] text-neutral-600">Tenant reports + listings</span>
      </div>
      {reported != null ? (
        <>
          <p className="mt-1 text-2xl font-semibold text-neutral-50">
            {formatRent(reported)}
            <span className="text-sm font-normal text-neutral-500">/mo median</span>
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            From {reportCount} rent data point{reportCount === 1 ? "" : "s"} (reviews +
            reported rents). Listings often omit fees, so use{" "}
            <a href="/calculator" className="text-orange-500 hover:underline">
              The Receipt
            </a>{" "}
            to compare.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">
          No rent reports yet. Be the first. Listings rarely show the real monthly
          cost.
        </p>
      )}
      {hasBreakdown && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {Object.entries(byBed).map(([label, rent]) =>
            rent != null ? (
              <li
                key={label}
                className="rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-0.5 text-xs text-neutral-400"
              >
                {label}: {formatRent(rent)}
              </li>
            ) : null
          )}
        </ul>
      )}
      {showTimeline && (
        <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Rent history
          </p>
          <ul className="mt-2 space-y-1.5">
            {byYear.map((row) => (
              <li
                key={row.year}
                className="flex items-baseline justify-between gap-2 text-sm text-neutral-300"
              >
                <span className="tabular-nums text-neutral-400">{row.year}</span>
                <span className="text-right">
                  <span className="font-medium text-neutral-100">
                    {formatRentFull(row.median_rent)}/mo
                  </span>
                  <span className="ml-2 text-xs text-neutral-500">
                    ({row.report_count} report{row.report_count === 1 ? "" : "s"})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={onReportRent}
        className="mt-2 text-xs font-medium text-orange-500 hover:underline"
      >
        Report what you pay →
      </button>
    </section>
  );
}
