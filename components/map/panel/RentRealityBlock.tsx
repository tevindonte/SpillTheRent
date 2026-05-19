"use client";

import type { BuildingDetail } from "@/lib/building-detail";
import { formatRent } from "@/lib/format";

type RentRealityBlockProps = {
  detail: BuildingDetail;
  onReportRent: () => void;
};

export function RentRealityBlock({ detail, onReportRent }: RentRealityBlockProps) {
  const reported = detail.median_rent;
  const reportCount = detail.rent_report_count;
  const byBed = detail.rent_by_bedroom ?? {};
  const hasBreakdown = Object.keys(byBed).length > 0;

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
            reported rents). Listings often omit fees — use{" "}
            <a href="/calculator" className="text-orange-500 hover:underline">
              The Receipt
            </a>{" "}
            to compare.
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">
          No rent reports yet. Be the first — listings rarely show the real monthly
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
