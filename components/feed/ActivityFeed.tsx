"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/relative-time";

type FeedItem = {
  id: string;
  complex_id: string;
  event_type: string;
  title: string;
  summary: string | null;
  created_at: string;
  building_name: string;
  borough: string | null;
  neighborhood: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  review: "Review",
  rent_report: "Rent",
  hpd_change: "HPD",
  micro_rating: "Ratings",
};

export function ActivityFeed({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/activity/feed?limit=50")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setItems(data.items ?? []);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load feed")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className={
        embedded
          ? "h-full overflow-y-auto bg-neutral-950 px-4 pb-20 pt-4"
          : "mx-auto min-h-[calc(100vh-3rem)] max-w-lg px-4 py-12"
      }
    >
      {!embedded && (
        <Link href="/" className="text-xs text-neutral-500 hover:text-orange-400">
          ← Map
        </Link>
      )}
      <h1
        className={
          embedded
            ? "text-lg font-semibold text-neutral-50"
            : "mt-4 text-2xl font-semibold text-neutral-50"
        }
      >
        City activity
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        New reviews, rent reports, and HPD changes across NYC.
      </p>

      {loading && (
        <p className="mt-8 text-sm text-neutral-500">Loading activity…</p>
      )}
      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">
          No recent activity yet. Rate a building or check back after ingest runs.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/?building=${item.complex_id}`}
              className="block rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 transition hover:border-neutral-700"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-400">
                  {TYPE_LABEL[item.event_type] ?? item.event_type}
                </span>
                <time className="text-[10px] text-neutral-600">
                  {formatRelativeTime(item.created_at)}
                </time>
              </div>
              <p className="mt-2 text-sm font-medium text-neutral-100">
                {item.building_name}
              </p>
              {(item.neighborhood || item.borough) && (
                <p className="text-xs text-neutral-500">
                  {[item.neighborhood, item.borough].filter(Boolean).join(", ")}
                </p>
              )}
              {item.summary && (
                <p className="mt-1 text-xs text-neutral-400">{item.summary}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
