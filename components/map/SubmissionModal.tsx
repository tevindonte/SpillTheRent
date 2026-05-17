"use client";

import { useEffect, useRef, useState } from "react";
import {
  AddressAutocomplete,
  type ComplexSearchResult,
} from "./AddressAutocomplete";
import {
  BEDROOM_OPTIONS,
  RED_FLAG_OPTIONS,
  UNIT_COUNT_OPTIONS,
  type BedroomOption,
  type RedFlagValue,
  type UnitCountOption,
} from "@/lib/submissions/constants";

type Tab = "rate" | "add";

type SubmissionModalProps = {
  open: boolean;
  onClose: () => void;
  prefillComplex?: ComplexSearchResult | null;
  rentFocus?: boolean;
};

export function SubmissionModal({
  open,
  onClose,
  prefillComplex = null,
  rentFocus = false,
}: SubmissionModalProps) {
  const [tab, setTab] = useState<Tab>("rate");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Rate form
  const [complex, setComplex] = useState<ComplexSearchResult | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [rent, setRent] = useState("");
  const [bedrooms, setBedrooms] = useState<BedroomOption | "">("");
  const [reviewText, setReviewText] = useState("");
  const [redFlags, setRedFlags] = useState<RedFlagValue[]>([]);
  const [anonymous, setAnonymous] = useState(true);

  // Add building form
  const [newAddress, setNewAddress] = useState("");
  const [unitCount, setUnitCount] = useState<UnitCountOption | "">("");
  const rentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (prefillComplex) {
      setComplex(prefillComplex);
      setTab("rate");
    }
    if (rentFocus) {
      requestAnimationFrame(() => rentInputRef.current?.focus());
    }
  }, [open, prefillComplex, rentFocus]);

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

  function resetForms() {
    setComplex(null);
    setRating(0);
    setHoverRating(0);
    setRent("");
    setBedrooms("");
    setReviewText("");
    setRedFlags([]);
    setAnonymous(true);
    setNewAddress("");
    setUnitCount("");
    setError(null);
    setSuccess(null);
  }

  function handleClose() {
    resetForms();
    setTab("rate");
    onClose();
  }

  function toggleRedFlag(flag: RedFlagValue) {
    setRedFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  }

  async function handleRateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!complex) {
      setError("Select a building from the search results.");
      return;
    }
    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }
    const rentNum = Number(rent.replace(/,/g, ""));
    if (!rentNum || rentNum < 0) {
      setError("Enter your monthly rent.");
      return;
    }
    if (!bedrooms) {
      setError("Select bedroom count.");
      return;
    }
    if (reviewText.trim().length < 50) {
      setError(`Review must be at least 50 characters (${reviewText.trim().length}/50).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complexId: complex.id,
          rating,
          rent: rentNum,
          bedrooms,
          reviewText: reviewText.trim(),
          redFlags,
          anonymous,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setSuccess("Thanks for sharing your experience!");
      setTimeout(handleClose, 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddBuildingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newAddress.trim().length < 5) {
      setError("Enter a full street address in Manhattan.");
      return;
    }
    if (!unitCount) {
      setError("Select an estimated unit count.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions/building", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: newAddress.trim(),
          unitCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      setSuccess(
        data.message ?? "Thanks, we'll verify and add this building soon"
      );
      setTimeout(handleClose, 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submission-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close"
      />

      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neutral-800 bg-neutral-950 shadow-2xl sm:rounded-2xl">
        <header className="shrink-0 border-b border-neutral-800 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="submission-modal-title"
                className="text-lg font-semibold text-neutral-100"
              >
                Share your experience
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Help renters make better decisions
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 flex gap-1 rounded-lg bg-neutral-900 p-1">
            <button
              type="button"
              onClick={() => {
                setTab("rate");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                tab === "rate"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Rate Your Building
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("add");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                tab === "add"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Add a Building
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {success && (
            <div className="mb-4 rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {tab === "rate" ? (
            <form onSubmit={handleRateSubmit} className="space-y-4">
              <AddressAutocomplete
                value={complex}
                onChange={setComplex}
                disabled={submitting}
              />

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
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
                      className="text-2xl leading-none transition"
                      aria-label={`${star} stars`}
                    >
                      <span
                        className={
                          star <= (hoverRating || rating)
                            ? "text-amber-400"
                            : "text-neutral-600"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                    Monthly rent ($)
                  </label>
                  <input
                    ref={rentInputRef}
                    type="number"
                    min={0}
                    step={1}
                    value={rent}
                    disabled={submitting}
                    onChange={(e) => setRent(e.target.value)}
                    placeholder="3200"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                    Bedrooms
                  </label>
                  <select
                    value={bedrooms}
                    disabled={submitting}
                    onChange={(e) =>
                      setBedrooms(e.target.value as BedroomOption | "")
                    }
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                  >
                    <option value="">Select…</option>
                    {BEDROOM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Your review ({reviewText.trim().length}/50 min)
                </label>
                <textarea
                  value={reviewText}
                  disabled={submitting}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={4}
                  placeholder="What’s it like living here? Management, noise, pests, fees…"
                  className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-neutral-500"
                />
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-neutral-400">
                  Red flags (optional)
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {RED_FLAG_OPTIONS.map((flag) => (
                    <label
                      key={flag.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-800 px-2.5 py-2 text-xs text-neutral-300 hover:border-neutral-600"
                    >
                      <input
                        type="checkbox"
                        disabled={submitting}
                        checked={redFlags.includes(flag.value)}
                        onChange={() => toggleRedFlag(flag.value)}
                        className="rounded border-neutral-600 bg-neutral-900 text-emerald-500"
                      />
                      {flag.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-400">
                <input
                  type="checkbox"
                  checked={anonymous}
                  disabled={submitting}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="rounded border-neutral-600 bg-neutral-900"
                />
                Post anonymously
              </label>

              <button
                type="submit"
                disabled={submitting || !!success}
                className="w-full rounded-lg bg-neutral-100 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit review"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddBuildingSubmit} className="space-y-4">
              <p className="text-sm text-neutral-400">
                Can&apos;t find your building? Submit the address and we&apos;ll
                verify it with Google Maps before adding it to the map.
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Street address
                </label>
                <input
                  type="text"
                  value={newAddress}
                  disabled={submitting}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g. 425 E 12th St, New York, NY"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Estimated unit count
                </label>
                <select
                  value={unitCount}
                  disabled={submitting}
                  onChange={(e) =>
                    setUnitCount(e.target.value as UnitCountOption | "")
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                >
                  <option value="">Select…</option>
                  {UNIT_COUNT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} units
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || !!success}
                className="w-full rounded-lg bg-neutral-100 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-white disabled:opacity-50"
              >
                {submitting ? "Validating…" : "Submit building"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
