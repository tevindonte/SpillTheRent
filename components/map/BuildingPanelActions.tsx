"use client";

import { getSiteUrl } from "@/lib/auth/site-url";
import { WatchlistButton } from "./panel/WatchlistButton";
import { addToCompare } from "@/lib/compare-buildings";
import type { Complex } from "@/lib/complexes";

type BuildingPanelActionsProps = {
  complex: Complex;
  onToast: (message: string) => void;
  onCompareChange?: () => void;
};

export function BuildingPanelActions({
  complex,
  onToast,
  onCompareChange,
}: BuildingPanelActionsProps) {
  const complexId = complex.id;

  async function handleCopyLink() {
    const url = `${getSiteUrl()}/?building=${complexId}`;
    try {
      await navigator.clipboard.writeText(url);
      onToast("Link copied!");
    } catch {
      onToast("Could not copy link.");
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleCopyLink()}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-orange-500/50"
        >
          🔗 Copy Link
        </button>
        <button
          type="button"
          onClick={() => {
            addToCompare({
              id: complex.id,
              name: complex.name,
              address: complex.address,
            });
            onToast("Added to compare (max 3).");
            onCompareChange?.();
          }}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-orange-500/50"
        >
          ⚖ Compare
        </button>
        <WatchlistButton complexId={complexId} onToast={onToast} />
      </div>
    </>
  );
}
