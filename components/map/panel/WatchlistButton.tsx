"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export function WatchlistButton({
  complexId,
  onToast,
}: {
  complexId: string;
  onToast: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/watchlist");
    if (!res.ok) return;
    const data = await res.json();
    setSaved((data.complex_ids as string[] | undefined)?.includes(complexId) ?? false);
  }, [user, complexId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle() {
    if (!user) {
      onToast("Sign in to save buildings to your watchlist.");
      return;
    }
    setLoading(true);
    try {
      if (saved) {
        const res = await fetch(
          `/api/watchlist?complex_id=${encodeURIComponent(complexId)}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setSaved(false);
          onToast("Removed from watchlist.");
        }
      } else {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complex_id: complexId }),
        });
        if (res.ok) {
          setSaved(true);
          onToast("Saved — we’ll add email alerts soon.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:border-orange-500/50"
      >
        ★ Watch (sign in)
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void toggle()}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        saved
          ? "border-orange-500/60 bg-orange-950/40 text-orange-300"
          : "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-orange-500/50"
      }`}
    >
      {saved ? "★ Watching" : "☆ Watch"}
    </button>
  );
}
