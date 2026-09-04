"use client";

import { useState } from "react";
import type { Complex } from "@/lib/complexes";
import { UNIT_COUNT_OPTIONS, type UnitCountOption } from "@/lib/submissions/constants";

type AddBuildingModalProps = {
  open: boolean;
  onClose: () => void;
  onExisting: (complex: Complex) => void;
  onCreated: (complexId: string, name: string) => void;
};

type GeocodeCandidate = {
  name: string;
  address: string;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  borough?: string | null;
  lat?: number;
  lng?: number;
};

export function AddBuildingModal({
  open,
  onClose,
  onExisting,
  onCreated,
}: AddBuildingModalProps) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<GeocodeCandidate | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [buildingName, setBuildingName] = useState("");
  const [unitCount, setUnitCount] = useState<UnitCountOption | "">("");

  function reset() {
    setAddress("");
    setError(null);
    setCandidate(null);
    setManualMode(false);
    setBuildingName("");
    setUnitCount("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setCandidate(null);
    setManualMode(false);
    try {
      const res = await fetch("/api/buildings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lookup failed");
        return;
      }
      if (data.status === "exists" && data.complex) {
        handleClose();
        onExisting(data.complex as Complex);
        return;
      }
      if (data.status === "geocode" && data.candidate) {
        setCandidate(data.candidate);
        return;
      }
      setManualMode(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function confirmGeocode() {
    if (!candidate) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/buildings/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "geocode", ...candidate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add");
        return;
      }
      handleClose();
      onCreated(data.complexId, candidate.name);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!unitCount) {
      setError("Select estimated units");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/buildings/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          address: address.trim(),
          name: buildingName.trim() || undefined,
          unitCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add");
        return;
      }
      handleClose();
      onCreated(data.complexId, buildingName.trim() || address.trim());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/70 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Add a Building</h2>
          <button type="button" onClick={handleClose} className="text-neutral-400">
            ✕
          </button>
        </div>

        {candidate ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="font-medium text-neutral-100">{candidate.name}</p>
              <p className="mt-1 text-sm text-neutral-500">{candidate.address}</p>
              <p className="mt-2 text-xs text-neutral-600">
                You can suggest a building name later from the building panel.
              </p>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={confirmGeocode}
              disabled={loading}
              className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400"
            >
              {loading ? "Adding…" : "Confirm & add building"}
            </button>
          </div>
        ) : manualMode ? (
          <form onSubmit={submitManual} className="space-y-4">
            <p className="text-sm text-neutral-500">
              We couldn&apos;t geocode this address. Add it manually.
            </p>
            <input
              value={address}
              readOnly
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-400"
            />
            <input
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="Building name (optional)"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100"
            />
            <select
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value as UnitCountOption)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100"
            >
              <option value="">Estimated units</option>
              {UNIT_COUNT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950"
            >
              Add building
            </button>
          </form>
        ) : (
          <form onSubmit={handleLookup} className="space-y-4">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address in NYC"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-orange-500/50"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
