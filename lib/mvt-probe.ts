import { buildMvtTileUrl } from "@/lib/mvt-url";
import type { MapFilters } from "@/lib/complexes";

/** Sample tile over lower Manhattan at z=12. */
const PROBE_TILE = { z: 12, x: 1205, y: 1539 };

let cachedOk: boolean | null = null;
let probePromise: Promise<boolean> | null = null;

/** True when MVT endpoint returns non-empty tile data. */
export async function probeMvtAvailable(
  filters: MapFilters = {}
): Promise<boolean> {
  if (cachedOk !== null) return cachedOk;
  if (probePromise) return probePromise;

  probePromise = (async () => {
    try {
      const template = buildMvtTileUrl(filters);
      const url = template
        .replace("{z}", String(PROBE_TILE.z))
        .replace("{x}", String(PROBE_TILE.x))
        .replace("{y}", String(PROBE_TILE.y));
      const res = await fetch(url);
      if (!res.ok) {
        cachedOk = false;
        return false;
      }
      const buf = await res.arrayBuffer();
      cachedOk = buf.byteLength > 0;
      return cachedOk;
    } catch {
      cachedOk = false;
      return false;
    } finally {
      probePromise = null;
    }
  })();

  return probePromise;
}

export function resetMvtProbeCache(): void {
  cachedOk = null;
  probePromise = null;
}
