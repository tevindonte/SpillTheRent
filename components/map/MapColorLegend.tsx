"use client";

import { useEffect, useState } from "react";
import type { MapColorMode } from "@/lib/map-color-mode";

type MapColorLegendProps = {
  mode: MapColorMode;
};

const RATING_ROWS = [
  { swatch: "#22c55e", label: "4.0+ rated" },
  { swatch: "#eab308", label: "3.0–4.0" },
  { swatch: "#ef4444", label: "Below 3.0" },
  { swatch: "#6b7280", label: "No data" },
] as const;

const RENT_ROWS = [
  { swatch: "#22c55e", label: "Below neighborhood median (deal)" },
  { swatch: "#eab308", label: "Near neighborhood median" },
  { swatch: "#ef4444", label: "Above neighborhood median" },
  { swatch: "#6b7280", label: "No rent data yet" },
] as const;

export function MapColorLegend({ mode }: MapColorLegendProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Desktop: start expanded; mobile: collapsed.
    const mq = window.matchMedia("(min-width: 640px)");
    setExpanded(mq.matches);
    const onChange = () => setExpanded(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const rows = mode === "rent" ? RENT_ROWS : RATING_ROWS;

  return (
    <div className="pointer-events-auto absolute bottom-16 left-3 z-[1001] sm:bottom-14 sm:left-14">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950/90 text-sm font-semibold text-neutral-300 shadow-lg backdrop-blur hover:text-white"
          aria-label="Show map color legend"
          title="Map legend"
        >
          ?
        </button>
      ) : (
        <div className="w-56 rounded-xl border border-neutral-800 bg-neutral-950/95 p-2.5 shadow-lg backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              {mode === "rent" ? "Rent vs neighborhood" : "Rating"}
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[10px] text-neutral-500 hover:text-neutral-300"
            >
              Hide
            </button>
          </div>
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center gap-2 text-[11px] text-neutral-300">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.swatch }}
                  aria-hidden
                />
                {row.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
