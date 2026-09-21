"use client";

import { useEffect, useState } from "react";
import { formatVisitorCount, VISITOR_BASELINE } from "@/lib/visitor-stats";

type Stats = {
  label: string;
  visitors: number;
};

/** Live visitor label for marketing copy (baseline + tracked uniques). */
export function useVisitorStatsLabel(): string {
  const [label, setLabel] = useState(() => formatVisitorCount(0));

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/analytics/stats")
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
      As seen by <strong className="text-neutral-100">15k+ people on TikTok</strong>
      . <strong className="text-neutral-100">{visitors}</strong> renters have
      already visited to check buildings before they sign.
    </p>
  );
}

export { VISITOR_BASELINE };
