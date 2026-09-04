"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RapSheetCard } from "@/components/RapSheetCard";
import type { BuildingDetail } from "@/lib/building-detail";
import { shareRapSheetImage } from "@/lib/share-rap-sheet";
import { redditShareUrl, twitterShareUrl } from "@/lib/share-social";

type RapSheetShareRowProps = {
  detail: BuildingDetail;
  onToast: (message: string) => void;
};

export function RapSheetShareRow({ detail, onToast }: RapSheetShareRowProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShareImage() {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const result = await shareRapSheetImage(cardRef.current, detail);
      onToast(
        result === "shared"
          ? "Rap Sheet shared!"
          : "Rap Sheet downloaded. Post it anywhere renters need the tea."
      );
    } catch {
      onToast("Could not generate Rap Sheet. Try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={sharing}
        onClick={() => void handleShareImage()}
        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-50"
      >
        {sharing ? "Generating…" : "📤 Share Rap Sheet"}
      </button>
      <a
        href={twitterShareUrl(detail)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-sky-500/50"
      >
        Post on X
      </a>
      <a
        href={redditShareUrl(detail)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-orange-500/50"
      >
        Reddit
      </a>

      {typeof document !== "undefined" &&
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
    </div>
  );
}
