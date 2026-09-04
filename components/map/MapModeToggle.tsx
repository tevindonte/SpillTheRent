"use client";

import type { MapColorMode } from "@/lib/map-color-mode";

type MapModeToggleProps = {
  mode: MapColorMode;
  onChange: (mode: MapColorMode) => void;
};

export function MapModeToggle({ mode, onChange }: MapModeToggleProps) {
  return (
    <div
      className="flex h-11 shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-900/95 text-xs shadow-lg backdrop-blur"
      role="group"
      aria-label="Map color mode"
    >
      <button
        type="button"
        onClick={() => onChange("rating")}
        className={`px-3 font-medium transition-colors ${
          mode === "rating"
            ? "bg-[#f97316] text-white"
            : "bg-transparent text-neutral-400 hover:text-neutral-200"
        }`}
        aria-pressed={mode === "rating"}
      >
        ⭐ By Rating
      </button>
      <button
        type="button"
        onClick={() => onChange("rent")}
        className={`px-3 font-medium transition-colors ${
          mode === "rent"
            ? "bg-[#f97316] text-white"
            : "bg-transparent text-neutral-400 hover:text-neutral-200"
        }`}
        aria-pressed={mode === "rent"}
      >
        💰 By Rent
      </button>
    </div>
  );
}
