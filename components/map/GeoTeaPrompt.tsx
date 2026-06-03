"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dismissGeoTeaPrompt,
  dismissGeoTeaPromptForever,
  isGeoTeaPromptSuppressed,
} from "@/lib/geo-tea-prompt";
import type { Complex } from "@/lib/complexes";

type NearbyBuilding = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  distance_m: number;
};

type GeoTeaPromptProps = {
  panelOpen: boolean;
  onSelectBuilding: (complex: Complex) => void;
};

export function GeoTeaPrompt({ panelOpen, onSelectBuilding }: GeoTeaPromptProps) {
  const [building, setBuilding] = useState<NearbyBuilding | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const tryLocate = useCallback(() => {
    if (panelOpen || isGeoTeaPromptSuppressed()) return;
    if (!navigator.geolocation) return;

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/complexes/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&limit=1`
          );
          const data = await res.json();
          if (!res.ok || !data.buildings?.length) {
            setVisible(false);
            return;
          }
          const b = data.buildings[0] as NearbyBuilding;
          if (b.distance_m > 800) {
            setVisible(false);
            return;
          }
          setBuilding(b);
          setVisible(true);
        } catch {
          setVisible(false);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setVisible(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  }, [panelOpen]);

  useEffect(() => {
    const t = window.setTimeout(tryLocate, 2500);
    return () => window.clearTimeout(t);
  }, [tryLocate]);

  if (!visible || !building || loading) return null;

  const hood =
    building.neighborhood ??
    building.borough ??
    "your area";

  return (
    <div
      className="pointer-events-auto absolute bottom-20 left-4 right-4 z-[1100] mx-auto max-w-md rounded-xl border border-orange-500/40 bg-neutral-950/95 p-4 shadow-xl backdrop-blur md:left-auto md:right-4"
      role="dialog"
      aria-label="Rate your building"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-orange-400">
        Spill the tea
      </p>
      <p className="mt-1 text-sm text-neutral-200">
        Looks like you&apos;re near <strong className="text-neutral-50">{hood}</strong>.
        Rate <strong className="text-neutral-50">{building.name}</strong> in 30 seconds —
        help the next renter.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onSelectBuilding({
              id: building.id,
              name: building.name,
              address: building.address,
              borough: building.borough,
              zip: null,
              units: null,
              google_rating: null,
              google_review_count: null,
              street_view_url: null,
              median_rent: null,
              review_count: 0,
              lat: building.lat,
              lng: building.lng,
            });
            dismissGeoTeaPrompt(1);
            setVisible(false);
          }}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-orange-400"
        >
          Rate this building
        </button>
        <button
          type="button"
          onClick={() => {
            dismissGeoTeaPrompt(7);
            setVisible(false);
          }}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => {
            dismissGeoTeaPromptForever();
            setVisible(false);
          }}
          className="text-xs text-neutral-600 hover:text-neutral-400"
        >
          Don&apos;t ask again
        </button>
      </div>
    </div>
  );
}
