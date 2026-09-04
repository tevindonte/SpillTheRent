"use client";

type RentModeSparseBannerProps = {
  onReport: () => void;
  onDismiss: () => void;
};

export function RentModeSparseBanner({
  onReport,
  onDismiss,
}: RentModeSparseBannerProps) {
  return (
    <div className="pointer-events-auto mt-2 max-w-xl rounded-xl border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs text-neutral-300 shadow-lg backdrop-blur">
      <p>
        Most buildings are gray because no rent has been reported yet.{" "}
        <button
          type="button"
          onClick={onReport}
          className="font-medium text-orange-400 hover:underline"
        >
          Report yours →
        </button>{" "}
        it takes 20 seconds.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-1 text-[10px] text-neutral-500 hover:text-neutral-300"
      >
        Dismiss
      </button>
    </div>
  );
}
