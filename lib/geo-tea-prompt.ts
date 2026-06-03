const STORAGE_KEY = "spill_geo_tea_prompt_v1";

export type GeoTeaDismiss = {
  until: number;
  never?: boolean;
};

export function loadGeoTeaDismiss(): GeoTeaDismiss | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeoTeaDismiss;
  } catch {
    return null;
  }
}

export function dismissGeoTeaPrompt(days = 7): void {
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ until }));
}

export function dismissGeoTeaPromptForever(): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ until: Date.now() + 3650 * 86400000, never: true })
  );
}

export function isGeoTeaPromptSuppressed(): boolean {
  const d = loadGeoTeaDismiss();
  if (!d) return false;
  return d.until > Date.now();
}
