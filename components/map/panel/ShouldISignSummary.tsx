"use client";

import type { BuildingDetail } from "@/lib/building-detail";
import {
  buildShouldISignSummary,
  verdictStyles,
} from "@/lib/should-i-sign";

export function ShouldISignSummary({ detail }: { detail: BuildingDetail }) {
  const summary = buildShouldISignSummary(detail);
  const styles = verdictStyles(summary.verdict);

  return (
    <section
      className={`mt-4 rounded-xl border p-3 ${styles.border} ${styles.bg}`}
      aria-labelledby="should-i-sign-heading"
    >
      <h3
        id="should-i-sign-heading"
        className={`text-sm font-semibold ${styles.text}`}
      >
        Should I sign?
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-300">
        {summary.headline}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-neutral-400">
        {summary.bullets.map((line) => (
          <li key={line} className="flex gap-1.5">
            <span className="text-neutral-600">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-neutral-600">
        Not legal advice. Cross-check HPD, walk the unit, read your lease.
      </p>
    </section>
  );
}
