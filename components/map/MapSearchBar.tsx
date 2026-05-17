"use client";

import { useEffect, useRef, useState } from "react";
import type { Complex } from "@/lib/complexes";

type SearchHit = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
};

type MapSearchBarProps = {
  onSelectBuilding: (complex: Complex) => void;
};

export function MapSearchBar({ onSelectBuilding }: MapSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/complexes/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function pick(hit: SearchHit) {
    setQuery(hit.name);
    setOpen(false);
    setSelecting(true);
    try {
      const res = await fetch(`/api/complexes/${hit.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const complex: Complex = {
        id: data.id,
        name: data.name,
        address: data.address,
        borough: data.borough,
        zip: data.zip,
        units: data.units,
        google_rating: data.google_rating,
        google_review_count: data.google_review_count,
        street_view_url: data.street_view_url,
        median_rent: data.median_rent,
        review_count: data.reviews?.length ?? 0,
        lat: data.lat,
        lng: data.lng,
      };
      onSelectBuilding(complex);
    } finally {
      setSelecting(false);
    }
  }

  return (
    <div ref={containerRef} className="pointer-events-auto relative w-full max-w-md">
      <label htmlFor="map-search" className="sr-only">
        Search buildings
      </label>
      <input
        id="map-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search any building in Manhattan…"
        disabled={selecting}
        className="w-full rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 text-sm text-neutral-100 shadow-lg backdrop-blur-sm placeholder:text-neutral-500 outline-none focus:border-orange-500/50"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 py-1 shadow-xl">
          {loading && (
            <li className="px-3 py-2 text-xs text-neutral-500">Searching…</li>
          )}
          {results.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => pick(hit)}
                className="w-full px-3 py-2.5 text-left hover:bg-neutral-900"
              >
                <p className="truncate text-sm font-medium text-neutral-100">
                  {hit.name}
                </p>
                {hit.address && (
                  <p className="truncate text-xs text-neutral-500">
                    {hit.address}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
