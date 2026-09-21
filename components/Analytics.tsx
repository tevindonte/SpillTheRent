"use client";

import { useEffect } from "react";

const VID_KEY = "spr_vid";
const DAY_KEY_PREFIX = "spr_visit_day_";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureVisitorId(): string {
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** First-party anonymous visit beacon (once per UTC day per browser). */
export function Analytics() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const day = todayUtc();
    const dayKey = `${DAY_KEY_PREFIX}${day}`;
    try {
      if (localStorage.getItem(dayKey)) return;
      localStorage.setItem(dayKey, "1");
    } catch {
      // private mode — still attempt one ping this session
    }

    const visitorId = ensureVisitorId();
    const path = window.location.pathname || "/";

    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, path }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // ignore network errors — analytics must never break the app
    });
  }, []);

  return null;
}
