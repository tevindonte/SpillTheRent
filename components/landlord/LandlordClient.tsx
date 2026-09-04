"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { portfolioScoreColor } from "@/lib/hpd";
import { formatRelativeTime } from "@/lib/relative-time";

type LandlordData = {
  landlord: {
    id: string;
    name: string;
    portfolio_score: string | null;
    building_count: number;
    total_units: number;
    avg_google_rating: number | null;
    avg_hpd_violations: number | null;
  };
  buildings: {
    id: string;
    name: string;
    address: string | null;
    zip: string | null;
    units: number | null;
    google_rating: number | null;
    hpd_violation_score: string | null;
    hpd_open_violations: number | null;
    coordinates: unknown;
  }[];
  portfolio_reviews: {
    id: string;
    rating: number | null;
    review_text: string | null;
    review_date: string | null;
    building_name: string | null;
    complex_id: string;
    is_anonymous: boolean;
    author_handle: string | null;
  }[];
};

export function LandlordClient({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<LandlordData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/landlords/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Landlord not found"));
  }, [id]);

  if (error) {
    return (
      <p className="px-4 py-16 text-center text-neutral-500">{error}</p>
    );
  }

  if (!data) {
    return <p className="px-4 py-16 text-center text-neutral-500">Loading…</p>;
  }

  const { landlord, buildings, portfolio_reviews } = data;

  function openBuilding(buildingId: string) {
    router.push(`/?building=${buildingId}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-16">
      <Link href="/" className="text-sm text-orange-500 hover:underline">
        ← Back to map
      </Link>

      <div className="mt-6 flex flex-wrap items-start gap-4">
        <h1 className="text-2xl font-semibold text-neutral-50">{landlord.name}</h1>
        {landlord.portfolio_score && (
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${portfolioScoreColor(landlord.portfolio_score)}`}
          >
            {landlord.portfolio_score} Portfolio
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Buildings" value={landlord.building_count} />
        <Stat label="Total units" value={landlord.total_units.toLocaleString()} />
        <Stat
          label="Avg rating"
          value={
            landlord.avg_google_rating != null
              ? landlord.avg_google_rating.toFixed(1)
              : "-"
          }
        />
        <Stat
          label="Avg HPD score"
          value={
            landlord.avg_hpd_violations != null
              ? landlord.avg_hpd_violations.toFixed(1)
              : "-"
          }
        />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-neutral-200">Buildings</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {buildings.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => openBuilding(b.id)}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-left hover:border-orange-500/40"
          >
            <p className="font-medium text-neutral-100">{b.name}</p>
            <p className="text-xs text-neutral-500">
              {b.address}
              {b.zip ? ` · ${b.zip}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
              {b.google_rating != null && (
                <span>{b.google_rating.toFixed(1)} ★ Google</span>
              )}
              {b.hpd_violation_score && (
                <span>HPD: {b.hpd_violation_score}</span>
              )}
              {b.units != null && <span>{b.units} units</span>}
            </div>
          </button>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold text-neutral-200">
        Reviews across portfolio
      </h2>
      {portfolio_reviews.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No reviews yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {portfolio_reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <p className="text-xs text-neutral-500">
                {r.building_name} ·{" "}
                {r.is_anonymous
                  ? "Anonymous"
                  : r.author_handle
                    ? `@${r.author_handle}`
                    : "Tenant"}
                {" · "}
                {formatRelativeTime(r.review_date)}
              </p>
              {r.rating != null && (
                <p className="mt-1 text-sm text-orange-400">{r.rating} ★</p>
              )}
              <p className="mt-2 text-sm text-neutral-300">{r.review_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
      <p className="text-2xl font-semibold text-orange-500">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
