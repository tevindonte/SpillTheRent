"use client";

import { useState } from "react";

export function LeaseShieldCard({
  premium,
}: {
  premium: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout unavailable");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  if (premium) {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4">
        <p className="text-sm font-semibold text-emerald-300">Lease Shield active</p>
        <p className="mt-1 text-xs text-neutral-400">
          Unlimited watchlist saves and email alerts on your shortlist.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4">
      <p className="text-sm font-semibold text-orange-300">Lease Shield</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
        $9.99 for 90 days — unlimited watchlist buildings + email when HPD, reviews,
        or rent reports change on saved buildings.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void checkout()}
        className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-50"
      >
        {loading ? "Loading…" : "Upgrade watchlist"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
