"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "spr_rent_cta_dismissed";

type ReportRentPromptProps = {
  onReport: () => void;
};

export function ReportRentPrompt({ onReport }: ReportRentPromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const timer = setTimeout(() => setVisible(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute bottom-28 left-4 right-4 z-[1002] sm:left-auto sm:right-4 sm:w-80">
      <div className="rounded-xl border border-neutral-700 bg-neutral-950/95 p-3 shadow-xl backdrop-blur-md">
        <p className="text-sm font-medium text-neutral-100">
          Live in NYC? Help future renters: report what you pay. Takes 20 seconds.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              dismiss();
              onReport();
            }}
            className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-semibold text-neutral-950 hover:bg-orange-400"
          >
            Report rent
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
