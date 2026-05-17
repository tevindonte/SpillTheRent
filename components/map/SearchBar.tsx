type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="pointer-events-auto w-full max-w-sm">
      <label htmlFor="complex-search" className="sr-only">
        Search complexes
      </label>
      <input
        id="complex-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search address, ZIP, or neighborhood…"
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900/95 px-4 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 shadow-lg backdrop-blur-sm outline-none transition focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
      />
    </div>
  );
}
