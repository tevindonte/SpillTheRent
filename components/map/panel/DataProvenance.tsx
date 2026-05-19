"use client";

import { useEffect, useState } from "react";

type FreshnessRow = {
  source_key: string;
  label: string;
  last_updated_at: string;
};

function formatAsOf(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function DataProvenance({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<FreshnessRow[]>([]);

  useEffect(() => {
    fetch("/api/data-freshness")
      .then((r) => (r.ok ? r.json() : { sources: [] }))
      .then((data) => setRows(data.sources ?? []))
      .catch(() => setRows([]));
  }, []);

  if (!rows.length) return null;

  if (compact) {
    const oldest = rows.reduce((a, b) =>
      a.last_updated_at < b.last_updated_at ? a : b
    );
    return (
      <p className="text-[10px] text-neutral-600">
        NYC data refreshed through {formatAsOf(oldest.last_updated_at)} ·{" "}
        <span className="text-neutral-500">Sources: HPD, DOB, bedbugs, OATH</span>
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        Data sources
      </p>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li
            key={row.source_key}
            className="flex justify-between gap-2 text-[10px] text-neutral-500"
          >
            <span>{row.label}</span>
            <span className="text-neutral-600">{formatAsOf(row.last_updated_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


