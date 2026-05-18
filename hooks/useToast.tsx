"use client";

import { useCallback, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3200);
  }, []);

  const Toast = message ? (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[3000] max-w-sm -translate-x-1/2 rounded-xl border border-orange-500/40 bg-neutral-950 px-4 py-3 text-center text-sm text-neutral-100 shadow-xl"
    >
      {message}
    </div>
  ) : null;

  return { showToast, Toast };
}
