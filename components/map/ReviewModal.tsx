"use client";

import { useEffect, useState } from "react";
import type { Complex } from "@/lib/complexes";
import {
  BEDROOM_OPTIONS,
  RED_FLAG_OPTIONS,
  type BedroomOption,
  type RedFlagValue,
} from "@/lib/submissions/constants";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

type ReviewModalProps = {
  open: boolean;
  complex: Complex | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ReviewModal({
  open,
  complex,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [redFlags, setRedFlags] = useState<RedFlagValue[]>([]);
  const [redFlagOther, setRedFlagOther] = useState("");
  const [rent, setRent] = useState("");
  const [bedrooms, setBedrooms] = useState<BedroomOption | "">("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function reset() {
    setRating(0);
    setReviewText("");
    setRedFlags([]);
    setRedFlagOther("");
    setRent("");
    setBedrooms("");
    setAnonymous(true);
    setError(null);
    setSuccess(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleFlag(flag: RedFlagValue) {
    setRedFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complex) return;
    setError(null);

    if (rating < 1) {
      setError("Select a star rating.");
      return;
    }
    if (reviewText.trim().length < 50) {
      setError(`Review must be at least 50 characters (${reviewText.trim().length}/50).`);
      return;
    }

    const rentNum = rent.trim() ? Number(rent.replace(/,/g, "")) : null;
    if (rent.trim() && (!rentNum || rentNum < 0)) {
      setError("Enter a valid monthly rent or leave blank.");
      return;
    }
    if (rentNum && !bedrooms) {
      setError("Select bedrooms when reporting rent.");
      return;
    }
    if (redFlags.includes("other") && !redFlagOther.trim()) {
      setError("Describe the other issue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complexId: complex.id,
          rating,
          reviewText: reviewText.trim(),
          redFlags,
          redFlagOther: redFlags.includes("other") ? redFlagOther.trim() : null,
          rent: rentNum,
          bedrooms: bedrooms || null,
          anonymous,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setSuccess(true);
      onSuccess?.();
      setTimeout(handleClose, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !complex) return null;

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="review-modal-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-5 py-4">
          <div>
            <h2 id="review-modal-title" className="text-lg font-semibold text-neutral-100">
              Rate This Building
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">{complex.name}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {success && (
            <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              Thanks for sharing your experience!
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-neutral-400">
              Your rating
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={submitting}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="text-2xl"
                >
                  <span
                    className={
                      star <= (hoverRating || rating)
                        ? "text-orange-500"
                        : "text-neutral-600"
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              What was your experience?
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              disabled={submitting}
              rows={4}
              placeholder="Be specific — management, pests, noise, repairs…"
              className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
            />
            <p className="mt-1 text-xs text-neutral-600">
              {reviewText.trim().length}/50 minimum
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-neutral-400">Red flags</p>
            <div className="flex flex-wrap gap-2">
              {RED_FLAG_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
                    redFlags.includes(opt.value)
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={redFlags.includes(opt.value)}
                    onChange={() => toggleFlag(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {redFlags.includes("other") && (
              <input
                type="text"
                value={redFlagOther}
                onChange={(e) => setRedFlagOther(e.target.value)}
                placeholder="Describe…"
                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
              />
            )}
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-400">
              Optional — rent you paid
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                placeholder="Monthly $"
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
              />
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value as BedroomOption | "")}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
              >
                <option value="">Bedrooms</option>
                {BEDROOM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="rounded border-neutral-600 accent-orange-500"
            />
            {anonymous
              ? "Your review will appear as Anonymous"
              : user
                ? "Your review will appear with your @handle"
                : "Sign in to show your @handle"}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>

          {!user && (
            <p className="text-center text-xs text-neutral-500">
              No account needed.{" "}
              <Link href="/login" className="text-orange-500 hover:underline">
                Create an account
              </Link>{" "}
              to track your review history.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
