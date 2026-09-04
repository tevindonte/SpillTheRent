"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  compareIds,
  loadCompareList,
  removeFromCompare,
  type CompareEntry,
} from "@/lib/compare-buildings";
import { compareShareUrl } from "@/lib/compare-url";
import { formatRent } from "@/lib/format";
import { getSiteUrl } from "@/lib/auth/site-url";

type CompareDetail = {
  id: string;
  name: string;
  spill_score: number | null;
  hpd_open_violations: number;
  hpd_violation_score: string | null;
  median_rent: number | null;
  red_flags: string[];
};

export function CompareDrawer({
  open,
  onClose,
  onListChange,
}: {
  open: boolean;
  onClose: () => void;
  onListChange?: () => void;
}) {
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [details, setDetails] = useState<CompareDetail[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setEntries(loadCompareList());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open || entries.length === 0) {
      setDetails([]);
      return;
    }
    setLoading(true);
    Promise.all(
      entries.map(async (e) => {
        const res = await fetch(`/api/complexes/${e.id}/detail`);
        if (!res.ok) return null;
        const d = await res.json();
        return {
          id: d.id,
          name: d.name,
          spill_score: d.spill_score,
          hpd_open_violations: d.hpd_open_violations,
          hpd_violation_score: d.hpd_violation_score,
          median_rent: d.median_rent,
          red_flags: d.red_flags ?? [],
        } satisfies CompareDetail;
      })
    )
      .then((rows) => setDetails(rows.filter(Boolean) as CompareDetail[]))
      .finally(() => setLoading(false));
  }, [open, entries]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-label="Compare buildings"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-neutral-800 bg-[#111] p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-100">Compare buildings</h2>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const url = compareShareUrl(getSiteUrl(), compareIds(entries));
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    window.prompt("Copy compare link:", url);
                  }
                }}
                className="text-xs text-orange-400 hover:underline"
              >
                Copy share link
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-neutral-500 hover:text-neutral-300"
            >
              Close
            </button>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            Open a building and tap &quot;Compare&quot; (up to 3).
          </p>
        ) : loading ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {details.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/?building=${d.id}`}
                      className="font-medium text-orange-400 hover:underline"
                      onClick={onClose}
                    >
                      {d.name}
                    </Link>
                    <p className="mt-1 text-xs text-neutral-500">
                      Score{" "}
                      {d.spill_score != null ? d.spill_score.toFixed(1) : "-"} · HPD{" "}
                      {d.hpd_violation_score ?? "-"} ({d.hpd_open_violations} open)
                      {d.median_rent != null && ` · ${formatRent(d.median_rent)}/mo`}
                    </p>
                    {d.red_flags.length > 0 && (
                      <p className="mt-1 text-[10px] text-neutral-600">
                        Flags: {d.red_flags.slice(0, 4).join(", ")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeFromCompare(d.id);
                      refresh();
                      onListChange?.();
                    }}
                    className="text-xs text-neutral-600 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
