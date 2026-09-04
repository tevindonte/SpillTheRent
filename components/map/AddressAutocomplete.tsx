"use client";

import { useEffect, useRef, useState } from "react";

export type ComplexSearchResult = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  zip: string | null;
};

type AddressAutocompleteProps = {
  value: ComplexSearchResult | null;
  onChange: (complex: ComplexSearchResult | null) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  autoFocus?: boolean;
};

export function AddressAutocomplete({
  value,
  onChange,
  disabled,
  hideLabel = false,
  autoFocus = false,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<ComplexSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
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

  return (
    <div ref={containerRef} className="relative">
      {!hideLabel && (
        <label className="mb-1.5 block text-xs font-medium text-neutral-400">
          Building address
        </label>
      )}
      <input
        type="text"
        value={query}
        disabled={disabled}
        autoFocus={autoFocus}
        data-rent-building-search={autoFocus ? "" : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search by address or name…"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
        autoComplete="off"
      />
      {loading && (
        <span
          className={`absolute right-3 text-xs text-neutral-500 ${hideLabel ? "top-3" : "top-9"}`}
        >
          …
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-800"
                onClick={() => {
                  onChange(item);
                  setQuery(item.name);
                  setOpen(false);
                }}
              >
                <span className="block font-medium text-neutral-100">
                  {item.name}
                </span>
                {item.address && item.address !== item.name && (
                  <span className="block text-xs text-neutral-500">
                    {item.address}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
