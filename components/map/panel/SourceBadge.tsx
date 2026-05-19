const SOURCE_META: Record<
  string,
  { label: string; title: string }
> = {
  user: { label: "Tenant", title: "Submitted by a spillthe.rent user" },
  google: { label: "Google", title: "Imported from Google Places" },
  apartments_com: {
    label: "Apartments.com",
    title: "Imported from Apartments.com",
  },
  reddit: { label: "Reddit", title: "Imported from Reddit" },
};

export function SourceBadge({ source }: { source?: string }) {
  const key = source ?? "user";
  const meta = SOURCE_META[key] ?? { label: key, title: "External review" };
  return (
    <span
      title={meta.title}
      className="rounded border border-neutral-700 bg-neutral-800/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-neutral-500"
    >
      {meta.label}
    </span>
  );
}
