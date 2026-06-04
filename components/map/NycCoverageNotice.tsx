"use client";

type NycCoverageNoticeProps = {
  variant: "visitor" | "viewport";
  onFlyToNyc: () => void;
  onDismiss?: () => void;
};

export function NycCoverageNotice({
  variant,
  onFlyToNyc,
  onDismiss,
}: NycCoverageNoticeProps) {
  const isVisitor = variant === "visitor";

  return (
    <div
      className="pointer-events-auto mx-auto max-w-md rounded-xl border border-neutral-700 bg-neutral-950/95 p-4 shadow-xl backdrop-blur"
      role="status"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-orange-400">
        {isVisitor ? "Outside NYC coverage" : "No data in this area"}
      </p>
      {isVisitor ? (
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Your device location isn&apos;t in our database yet — we only have
          buildings for <strong className="text-neutral-100">Manhattan, Brooklyn
          &amp; Long Island City</strong> right now. The map starts in NYC so you
          can still research places here; we&apos;re not blocking you from
          panning elsewhere.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          There aren&apos;t any buildings on the map here. Coverage today is NYC
          only — drag back toward the city or use the button below.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFlyToNyc}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-orange-400"
        >
          {isVisitor ? "Jump to NYC" : "Back to NYC"}
        </button>
        {isVisitor && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
