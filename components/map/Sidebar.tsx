import type { Complex } from "@/lib/complexes";
import { formatRating, ratingColor } from "@/lib/complexes";
import { formatRent } from "@/lib/format";

type SidebarProps = {
  complexes: Complex[];
  loading?: boolean;
  onSelect?: (complex: Complex) => void;
};

export function Sidebar({ complexes, loading, onSelect }: SidebarProps) {
  return (
    <aside className="pointer-events-auto flex h-full w-full max-w-sm flex-col border-l border-neutral-800 bg-neutral-950/95 shadow-2xl backdrop-blur-sm">
      <header className="shrink-0 border-b border-neutral-800 px-4 py-4">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-100">
          SpillTheRent
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          {loading
            ? "Loading complexes…"
            : `${complexes.length.toLocaleString()} in view`}
        </p>
      </header>

      <ul className="flex-1 overflow-y-auto overscroll-contain">
        {loading && (
          <li className="px-4 py-8 text-center text-sm text-neutral-500">
            Loading…
          </li>
        )}
        {!loading && complexes.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-neutral-500">
            No complexes in this area. Pan or zoom the map, or adjust your
            search.
          </li>
        )}
        {!loading &&
          complexes.map((complex) => (
            <li
              key={complex.id}
              className={`border-b border-neutral-800/80 px-4 py-3 transition hover:bg-neutral-900/80 ${
                onSelect ? "cursor-pointer" : ""
              }`}
              onClick={onSelect ? () => onSelect(complex) : undefined}
              onKeyDown={
                onSelect
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(complex);
                      }
                    }
                  : undefined
              }
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: ratingColor(complex.google_rating) }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-neutral-100">
                      {complex.name}
                    </p>
                    {formatRent(complex.median_rent) && (
                      <span className="shrink-0 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        {formatRent(complex.median_rent)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {complex.address}
                    {complex.zip ? ` · ${complex.zip}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-400">
                    {complex.units != null && (
                      <span>{complex.units} units</span>
                    )}
                    <span>{formatRating(complex.google_rating)}</span>
                    {complex.google_review_count != null && (
                      <span>
                        {complex.google_review_count.toLocaleString()} reviews
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
      </ul>
    </aside>
  );
}
