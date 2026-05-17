"use client";

import type { MapFilters } from "@/lib/complexes";

type MapFilterPanelProps = {
  open: boolean;
  onClose: () => void;
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
};

export function MapFilterPanel({
  open,
  onClose,
  filters,
  onChange,
}: MapFilterPanelProps) {
  if (!open) return null;

  const minRating = filters.minGoogleRating ?? 0;

  return (
    <div className="pointer-events-auto absolute left-4 top-28 z-[1001] w-72 rounded-xl border border-neutral-800 bg-neutral-950/98 p-4 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100">Filters</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Close
        </button>
      </div>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={!!filters.rentStabilizedOnly}
          onChange={(e) =>
            onChange({ ...filters, rentStabilizedOnly: e.target.checked })
          }
          className="rounded border-neutral-600"
        />
        Rent stabilized only
      </label>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={!!filters.hasHpdViolations}
          onChange={(e) =>
            onChange({ ...filters, hasHpdViolations: e.target.checked })
          }
          className="rounded border-neutral-600"
        />
        Has HPD violations
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-neutral-400">
          <span>Min Google rating</span>
          <span className="font-medium text-orange-400">
            {minRating === 0 ? "Any" : minRating.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={minRating}
          onChange={(e) =>
            onChange({
              ...filters,
              minGoogleRating: parseFloat(e.target.value),
            })
          }
          className="w-full accent-orange-500"
        />
      </div>

      <button
        type="button"
        onClick={() =>
          onChange({
            rentStabilizedOnly: false,
            hasHpdViolations: false,
            minGoogleRating: 0,
          })
        }
        className="mt-4 w-full text-center text-xs text-orange-500 hover:underline"
      >
        Clear all filters
      </button>
    </div>
  );
}
