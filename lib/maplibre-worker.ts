"use client";

import { setWorkerUrl } from "maplibre-gl";

/**
 * MapLibre v6 worker must be same-origin and sit next to shared.mjs.
 * See scripts/copy-maplibre-worker.mjs.
 */
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}
