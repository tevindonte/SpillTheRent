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

export default function FeedPage() {
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
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-xl px-4 py-12">
      <Link href="/" className="text-xs text-neutral-500 hover:text-orange-400">
        ← Map
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-50">
        NYC building activity
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        New reviews, rent reports, and violation updates across spillthe.rent.
      </p>

      {loading && (
        <p className="mt-8 text-sm text-neutral-500">Loading activity…</p>
      )}
      {error && (
        <p className="mt-8 text-sm text-red-400">
          {error}
          {error.includes("building_events") && (
            <span className="block mt-2 text-neutral-500">
              Run migration <code className="text-orange-400">20260606000001_growth_platform.sql</code> in Supabase.
            </span>
          )}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">
          No recent activity yet. Submit a review or report rent to seed the feed.
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/?building=${item.complex_id}`}
              className="block rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-orange-500/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-orange-500/90">
                  {TYPE_LABEL[item.event_type] ?? item.event_type}
                </span>
                <span className="text-[10px] text-neutral-600">
                  {formatRelativeTime(item.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-neutral-100">
                {item.title}
              </p>
              {item.summary && (
                <p className="mt-0.5 text-xs text-neutral-500">{item.summary}</p>
              )}
              <p className="mt-1 text-[10px] text-neutral-600">
                {item.neighborhood ? `${item.neighborhood}, ` : ""}
                {item.borough ?? "NYC"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
