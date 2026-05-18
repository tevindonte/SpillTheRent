"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BOROUGH_PILLS, type BoroughArea } from "@/lib/map-boroughs";

type LeaderboardRow = {
  id: string;
  name: string;
  building_count: number;
  total_units: number;
  total_hpd: number;
  total_hp: number;
  total_bedbugs: number;
  total_oath: number;
  score: number;
  portfolio_score: string | null;
  worst_building: { id: string; name: string; score: number } | null;
};

function rankAccent(rank: number): string {
  if (rank === 1) return "text-amber-400 border-amber-500/40 bg-amber-950/30";
  if (rank === 2) return "text-neutral-300 border-neutral-400/40 bg-neutral-800/50";
  if (rank === 3) return "text-orange-300 border-orange-600/40 bg-orange-950/30";
  return "text-neutral-400 border-neutral-800 bg-neutral-900/40";
}

export default function LeaderboardPage() {
  const [boroughArea, setBoroughArea] = useState<BoroughArea>("all");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = boroughArea === "all" ? "" : `?boroughArea=${boroughArea}`;
    fetch(`/api/leaderboard${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setRows(data.landlords ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [boroughArea]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pt-14">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-50">
          NYC&apos;s Worst Landlords 🏚️
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          These landlords own the most violated buildings in NYC. Data pulled
          directly from HPD, Housing Court, and city records. Updated monthly.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Ranked by open HPD violations, tenant lawsuits, and bedbug reports.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {BOROUGH_PILLS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setBoroughArea(opt.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              boroughArea === opt.id
                ? "border-orange-500/60 bg-orange-950/40 text-orange-400"
                : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading leaderboard…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500">No landlords found for this area.</p>
          ) : (
            rows.map((row, i) => {
              const rank = i + 1;
              return (
                <Link
                  key={row.id}
                  href={`/landlord/${row.id}`}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-colors hover:border-orange-500/40 ${rankAccent(rank)}`}
                >
                  <span className="w-8 shrink-0 text-lg font-bold">#{rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-100">{row.name}</p>
                    <p className="text-xs text-neutral-500">
                      {row.building_count} buildings · {row.total_units.toLocaleString()} units
                      {row.portfolio_score ? ` · ${row.portfolio_score} portfolio` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
                    <span>HPD: {row.total_hpd}</span>
                    <span>HP: {row.total_hp}</span>
                    <span>Bedbugs: {row.total_bedbugs}</span>
                    <span className="font-semibold text-orange-400">Score: {row.score}</span>
                  </div>
                  <span className="text-xs text-orange-500">View Portfolio →</span>
                </Link>
              );
            })
          )}
        </div>
      )}

      <p className="mt-10 border-t border-neutral-800 pt-6 text-xs leading-relaxed text-neutral-500">
        Data sourced from NYC Open Data, HPD, and NYC Housing Court public records.
        spillthe.rent does not editorialize — we display government records as-is.
      </p>
    </div>
  );
}
