"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { hpdScoreColor } from "@/lib/hpd";

type WatchedBuilding = {
  complex_id: string;
  created_at: string;
  name: string;
  address: string | null;
  spill_score: number | null;
  hpd_violation_score: string | null;
};

export function WatchedBuildingsSection() {
  const [buildings, setBuildings] = useState<WatchedBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load watchlist");
      setBuildings(data.buildings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unwatch(complexId: string) {
    const prev = buildings;
    setBuildings((list) => list.filter((b) => b.complex_id !== complexId));
    try {
      const res = await fetch(
        `/api/watchlist?complex_id=${encodeURIComponent(complexId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not unwatch");
      }
    } catch {
      setBuildings(prev);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading watched buildings…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (buildings.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No buildings watched yet. Click ★ Watch on any building to track it here.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {buildings.map((b) => (
        <li
          key={b.complex_id}
          className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-neutral-100">{b.name}</p>
              {b.address && (
                <p className="mt-0.5 text-sm text-neutral-500">{b.address}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {b.spill_score != null && (
                  <span className="rounded-full border border-orange-800/60 bg-orange-950/40 px-2 py-0.5 text-[11px] font-medium text-orange-300">
                    Score {b.spill_score.toFixed(1)}
                  </span>
                )}
                {b.hpd_violation_score && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${hpdScoreColor(b.hpd_violation_score)}`}
                  >
                    HPD {b.hpd_violation_score}
                  </span>
                )}
              </div>
              <Link
                href={`/?building=${b.complex_id}`}
                className="mt-3 inline-block text-xs font-medium text-orange-500 hover:underline"
              >
                View on map →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => void unwatch(b.complex_id)}
              className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:border-red-800 hover:text-red-300"
            >
              Unwatch
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
