"use client";

type SubmissionFabProps = {
  onOpen: () => void;
  panelOpen?: boolean;
};

export function SubmissionFab({ onOpen, panelOpen = false }: SubmissionFabProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`pointer-events-auto fixed bottom-[7.25rem] left-1/2 z-[1001] -translate-x-1/2 rounded-full border border-neutral-700 bg-neutral-900/95 px-5 py-3 text-sm font-semibold text-neutral-100 shadow-lg backdrop-blur-sm transition hover:border-neutral-500 hover:bg-neutral-800 sm:left-auto sm:translate-x-0 ${
        panelOpen ? "sm:right-[calc(28rem+1.5rem)]" : "sm:right-[calc(24rem+1.5rem)]"
      }`}
    >
      Rate Your Building
    </button>
  );
}
