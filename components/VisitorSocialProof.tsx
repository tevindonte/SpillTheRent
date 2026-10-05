"use client";

import { useEffect, useState } from "react";
import {
  formatVisitorCount,
  TIKTOK_VIEWS_LABEL,
  VISITOR_BASELINE,
} from "@/lib/visitor-stats";

type Stats = {
  label: string;
  visitors: number;
};

/** Live visitor label for marketing copy (baseline + tracked uniques). */
export function useVisitorStatsLabel(): string {
  const [label, setLabel] = useState(() => formatVisitorCount(0));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/analytics/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Stats | null) => {
        if (cancelled || !data?.label) return;
        setLabel(data.label);
      })
      .catch(() => {
        /* keep baseline fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return label;
}

export function VisitorSocialProofLine({ className }: { className?: string }) {
  const visitors = useVisitorStatsLabel();
  return (
    <p className={className}>
      As seen by{" "}
      <strong className="text-neutral-100">
        {TIKTOK_VIEWS_LABEL} people on TikTok
      </strong>
      . <strong className="text-neutral-100">{visitors}</strong> renters have
      already visited to check buildings before they sign.
    </p>
  );
}

/** Compact one-liner for footers / login / share cards. */
export function VisitorSocialProofCompact({
  className,
}: {
  className?: string;
}) {
  const visitors = useVisitorStatsLabel();
  return (
    <p className={className}>
      {TIKTOK_VIEWS_LABEL} on TikTok · {visitors} site visits
    </p>
  );
}

export { TIKTOK_VIEWS_LABEL, VISITOR_BASELINE };
