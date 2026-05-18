"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RapSheetCard } from "@/components/RapSheetCard";
import type { BuildingDetail } from "@/lib/building-detail";
import { getSiteUrl } from "@/lib/auth/site-url";
import { shareRapSheetImage } from "@/lib/share-rap-sheet";

type BuildingPanelActionsProps = {
  complexId: string;
  detail: BuildingDetail | null;
  onToast: (message: string) => void;
};

export function BuildingPanelActions({
  complexId,
  detail,
  onToast,
}: BuildingPanelActionsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShareRapSheet() {
    if (!detail || !cardRef.current) return;
    setSharing(true);
    try {
      await shareRapSheetImage(cardRef.current, detail);
      onToast("Rap Sheet copied! Drop it anywhere renters need to know.");
    } catch {
      onToast("Could not generate Rap Sheet. Try again.");
    } finally {
      setSharing(false);
    }
  }

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
          disabled={!detail || sharing}
          onClick={() => void handleShareRapSheet()}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-orange-500/50 disabled:opacity-50"
        >
          {sharing ? "Generating…" : "📤 Share Rap Sheet"}
        </button>
        <button
          type="button"
          onClick={() => void handleCopyLink()}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-orange-500/50"
        >
          🔗 Copy Link
        </button>
      </div>

      {detail &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed -left-[9999px] top-0"
          >
            <div ref={cardRef}>
              <RapSheetCard detail={detail} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
