"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const FIELDS = [
  { key: "pests", label: "Pests" },
  { key: "management", label: "Management" },
  { key: "heatHotWater", label: "Heat / hot water" },
  { key: "noise", label: "Noise" },
] as const;

type MicroRatingBlockProps = {
  complexId: string;
  onToast: (message: string) => void;
};

export function MicroRatingBlock({ complexId, onToast }: MicroRatingBlockProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user) {
      onToast("Sign in to rate your building in 30 seconds.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/submissions/micro-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complexId,
          pests: scores.pests,
          management: scores.management,
          heatHotWater: scores.heatHotWater,
          noise: scores.noise,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onToast("Thanks — quick ratings help the next renter.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not save ratings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Quick ratings (30 sec)
      </h3>
      <p className="mt-1 text-[11px] text-neutral-500">
        Tap 1–5 for each — no essay required.
      </p>
      <ul className="mt-3 space-y-2">
        {FIELDS.map(({ key, label }) => (
          <li key={key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-400">{label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setScores((s) => ({ ...s, [key]: s[key] === n ? null : n }))
                  }
                  className={`h-7 w-7 rounded text-xs ${
                    scores[key] === n
                      ? "bg-orange-500 text-neutral-950"
                      : "bg-neutral-800 text-neutral-500 hover:bg-neutral-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={saving}
        onClick={() => void submit()}
        className="mt-3 w-full rounded-lg bg-neutral-800 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Submit quick ratings"}
      </button>
    </section>
  );
}
