"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRent } from "@/lib/format";

type Submission = {
  id: string;
  file_name: string | null;
  status: string;
  parsed_at: string | null;
  parse_error: string | null;
  parsed_data: {
    suggested_legal_rent?: number | null;
    overcharge_hint?: boolean;
  } | null;
  created_at: string;
  complexes: { name: string; address: string | null } | null;
};

export function DhcrSubmissionsCard() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dhcr/mine")
      .then((res) => res.json())
      .then((data) => {
        if (data.submissions) setItems(data.submissions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-neutral-300">DHCR rent history</h2>
        <Link
          href="/tools/rent-history"
          className="text-xs text-orange-400 hover:underline"
        >
          Upload PDF →
        </Link>
      </div>
      {loading ? (
        <p className="mt-2 text-xs text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-500">
          No uploads yet. Add your official DHCR letter to check legal rent.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-neutral-800/80 bg-neutral-950/50 px-3 py-2 text-xs"
            >
              <p className="font-medium text-neutral-200">
                {s.complexes?.name ?? s.file_name ?? "Upload"}
              </p>
              <p className="text-neutral-500">
                {new Date(s.created_at).toLocaleDateString()} · {s.status}
                {s.parsed_data?.suggested_legal_rent != null &&
                  ` · ${formatRent(s.parsed_data.suggested_legal_rent)}/mo`}
                {s.parsed_data?.overcharge_hint && (
                  <span className="text-amber-400"> · possible overcharge</span>
                )}
              </p>
              {s.parse_error && s.status === "failed" && (
                <p className="mt-0.5 text-[10px] text-neutral-600">{s.parse_error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
