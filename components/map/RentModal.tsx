"use client";

import { useEffect, useState } from "react";
import type { Complex } from "@/lib/complexes";
import {
  BEDROOM_OPTIONS,
  MOVE_IN_YEAR_START,
  type BedroomOption,
} from "@/lib/submissions/constants";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import {
  AddressAutocomplete,
  type ComplexSearchResult,
} from "./AddressAutocomplete";

type RentModalProps = {
  open: boolean;
  complex: Complex | null;
  onClose: () => void;
  onSuccess?: () => void;
  /** When true and no complex, focus building search first. */
  preferSearch?: boolean;
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from(
  { length: currentYear - MOVE_IN_YEAR_START + 1 },
  (_, i) => currentYear - i
);

export function RentModal({
  open,
  complex: initialComplex,
  onClose,
  onSuccess,
  preferSearch = false,
}: RentModalProps) {
  const { user } = useAuth();
  const [picked, setPicked] = useState<ComplexSearchResult | null>(null);
  const [rent, setRent] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [bedrooms, setBedrooms] = useState<BedroomOption | "">("");
  const [moveInYear, setMoveInYear] = useState(String(currentYear));
  const [moveOutYear, setMoveOutYear] = useState("");
  const [stillHere, setStillHere] = useState(true);
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complexId = initialComplex?.id ?? picked?.id ?? null;
  const complexName =
    initialComplex?.name ?? picked?.name ?? null;
  const needsSearch = !initialComplex && preferSearch;

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setError(null);
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

  function handleClose() {
    setPicked(null);
    setRent("");
    setUnitNumber("");
    setBedrooms("");
    setMoveInYear(String(currentYear));
    setMoveOutYear("");
    setStillHere(true);
    setAnonymous(true);
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complexId) {
      setError("Search and select your building first.");
      return;
    }
    setError(null);

    const rentNum = Number(rent.replace(/,/g, ""));
    if (!rentNum || rentNum < 0) {
      setError("Enter your monthly rent.");
      return;
    }
    if (!bedrooms) {
      setError("Select bedroom count.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complexId,
          rent: rentNum,
          bedrooms,
          moveInYear: Number(moveInYear),
          moveOutYear: stillHere ? null : moveOutYear ? Number(moveOutYear) : null,
          anonymous,
          unitNumber: unitNumber.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
        return;
      }
      onSuccess?.();
      handleClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  if (!needsSearch && !initialComplex) return null;

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Report Rent</h2>
            {complexName && (
              <p className="mt-0.5 text-xs text-neutral-500">{complexName}</p>
            )}
          </div>
          <button type="button" onClick={handleClose} className="text-neutral-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {error && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {needsSearch && (
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">
                Your building
              </label>
              <AddressAutocomplete
                value={picked}
                onChange={setPicked}
                disabled={submitting}
                hideLabel
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs text-neutral-400">Monthly rent ($)</label>
            <input
              type="number"
              required
              min={0}
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-neutral-400">
              Unit number <span className="text-neutral-600">(optional)</span>
            </label>
            <input
              type="text"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="e.g. 4B"
              maxLength={32}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-orange-500/50 placeholder:text-neutral-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-neutral-400">Bedrooms</label>
            <select
              required
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value as BedroomOption)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100"
            >
              <option value="">Select…</option>
              {BEDROOM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">Move-in year</label>
              <select
                value={moveInYear}
                onChange={(e) => setMoveInYear(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">Move-out year</label>
              <select
                value={moveOutYear}
                disabled={stillHere}
                onChange={(e) => setMoveOutYear(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 disabled:opacity-50"
              >
                <option value="">-</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={stillHere}
              onChange={(e) => setStillHere(e.target.checked)}
              className="accent-orange-500"
            />
            Still living here
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-orange-500"
            />
            Report anonymously
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit rent report"}
          </button>

          {!user && (
            <p className="text-center text-xs text-neutral-500">
              <Link href="/login" className="text-orange-500 hover:underline">
                Sign in
              </Link>{" "}
              to save rental history on your profile.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
